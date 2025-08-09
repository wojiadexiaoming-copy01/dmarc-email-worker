import { Env } from './types'

// CloudBase HTTP API客户端
export class UniCloudClient {
  private spaceId: string
  private spaceAppId: string
  private accessKey: string
  private secretKey: string
  private uploadDomain: string
  private downloadDomain: string
  private requestDomain: string

  constructor(env: Env) {
    // 硬编码CloudBase配置
    this.spaceId = 'env-00jxt0xsffn5'
    this.spaceAppId = '2021004134605314'
    this.accessKey = 'gah82pAcM7dq85Ih'
    this.secretKey = '9QASalzyyRI5vs4q'
    this.uploadDomain = 'https://u.object.cloudrun.cloudbaseapp.cn'
    this.downloadDomain = 'https://env-00jxt0xsffn5.normal.cloudstatic.cn'
    this.requestDomain = 'https://env-00jxt0xsffn5.api-hz.cloudbasefunction.cn'
  }

  // 生成CloudBase访问签名
  private generateSignature(timestamp: number, method: string, path: string): string {
    console.log('🔐 Generating signature...')
    console.log('  - Method:', method)
    console.log('  - Path:', path)
    console.log('  - Timestamp:', timestamp)
    console.log('  - Access Key:', this.accessKey.substring(0, 4) + '****')
    
    const stringToSign = `${method}\n${path}\n${timestamp}`
    console.log('  - String to sign:', stringToSign)
    
    // 简化版签名，实际使用中需要HMAC-SHA256
    const signature = btoa(`${this.accessKey}:${stringToSign}:${this.secretKey}`).substring(0, 32)
    console.log('  - Generated signature:', signature.substring(0, 8) + '****')
    
    return signature
  }

  // 获取访问令牌（CloudBase方式）
  private async getAccessToken(): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = this.generateSignature(timestamp, 'POST', '/auth/token')
    
    const response = await fetch(`${this.requestDomain}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CloudBase-SpaceId': this.spaceId,
        'X-CloudBase-AppId': this.spaceAppId,
        'X-CloudBase-Timestamp': timestamp.toString(),
        'X-CloudBase-Signature': signature,
      },
      body: JSON.stringify({
        spaceId: this.spaceId,
        accessKey: this.accessKey,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`)
    }

    const data = await response.json()
    return data.access_token || data.token
  }

  // 上传文件到CloudBase云存储
  async uploadFile(filename: string, content: ArrayBuffer | string): Promise<string> {
    console.log('☁️ ===== CloudBase File Upload =====')
    console.log('📁 Filename:', filename)
    console.log('📏 Content size:', content instanceof ArrayBuffer ? content.byteLength : content.length, 'bytes')
    console.log('📦 Content type:', content instanceof ArrayBuffer ? 'ArrayBuffer' : 'string')
    
    try {
      // 生成文件路径
      const date = new Date()
      const filePath = `dmarc-reports/${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${filename}`
      console.log('📂 Generated file path:', filePath)
      
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = this.generateSignature(timestamp, 'POST', '/storage/upload')
      console.log('🔐 Generated signature for timestamp:', timestamp)
      
      console.log('📤 Preparing upload request...')
      console.log('🌐 Upload domain:', this.uploadDomain)
      console.log('🆔 Space ID:', this.spaceId)
      console.log('📱 App ID:', this.spaceAppId)
      
      const formData = new FormData()
      const blob = content instanceof ArrayBuffer ? new Blob([content]) : new Blob([content])
      formData.append('file', blob, filename)
      formData.append('path', filePath)
      formData.append('spaceId', this.spaceId)

      console.log('🚀 Sending upload request...')
      const response = await fetch(`${this.uploadDomain}/storage/upload`, {
        method: 'POST',
        headers: {
          'X-CloudBase-SpaceId': this.spaceId,
          'X-CloudBase-AppId': this.spaceAppId,
          'X-CloudBase-Timestamp': timestamp.toString(),
          'X-CloudBase-Signature': signature,
        },
        body: formData,
      })

      console.log('📡 Upload response status:', response.status, response.statusText)
      console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Upload failed with response:', errorText)
        throw new Error(`Failed to upload file: ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📄 Upload response data:', JSON.stringify(data, null, 2))
      
      const fileUrl = data.fileUrl || data.url || `${this.downloadDomain}/${filePath}`
      console.log('🔗 Final file URL:', fileUrl)
      console.log('✅ File upload completed successfully!')
      
      return fileUrl
    } catch (error) {
      console.error('💥 Upload file error:', error)
      console.error('📋 Error details:', {
        message: error.message,
        stack: error.stack,
        filename: filename,
        contentSize: content instanceof ArrayBuffer ? content.byteLength : content.length
      })
      throw error
    }
  }

  // 插入数据到CloudBase数据库
  async insertDmarcRecord(record: any): Promise<string> {
    console.log('💾 ===== CloudBase Single Record Insert =====')
    console.log('📊 Record details:', {
      reportId: record.reportMetadataReportId,
      domain: record.policyPublishedDomain,
      sourceIP: record.recordRowSourceIP,
      count: record.recordRowCount
    })
    
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = this.generateSignature(timestamp, 'POST', '/database/collection/dmarc_reports/add')
      console.log('🔐 Generated signature for timestamp:', timestamp)
      
      const recordWithTimestamp = {
        ...record,
        createTime: Date.now(),
        updateTime: Date.now(),
      }
      
      console.log('🚀 Sending insert request...')
      console.log('🌐 Request domain:', this.requestDomain)
      console.log('🆔 Space ID:', this.spaceId)
      console.log('📱 App ID:', this.spaceAppId)
      
      const response = await fetch(`${this.requestDomain}/database/collection/dmarc_reports/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CloudBase-SpaceId': this.spaceId,
          'X-CloudBase-AppId': this.spaceAppId,
          'X-CloudBase-Timestamp': timestamp.toString(),
          'X-CloudBase-Signature': signature,
        },
        body: JSON.stringify({
          data: recordWithTimestamp,
        }),
      })

      console.log('📡 Insert response status:', response.status, response.statusText)
      console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Insert failed with response:', errorText)
        throw new Error(`Failed to insert record: ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📄 Insert response data:', JSON.stringify(data, null, 2))
      
      const recordId = data.id || data._id || 'unknown'
      console.log('🆔 Inserted record ID:', recordId)
      console.log('✅ Single record insert completed successfully!')
      
      return recordId
    } catch (error) {
      console.error('💥 Insert record error:', error)
      console.error('📋 Error details:', {
        message: error.message,
        stack: error.stack,
        reportId: record.reportMetadataReportId,
        domain: record.policyPublishedDomain
      })
      throw error
    }
  }

  // 批量插入数据到CloudBase数据库
  async batchInsertDmarcRecords(records: any[]): Promise<string[]> {
    console.log('💾 ===== CloudBase Batch Insert =====')
    console.log('📊 Records to insert:', records.length)
    
    // 记录每个记录的基本信息
    records.forEach((record, index) => {
      console.log(`📝 Record ${index + 1}:`, {
        reportId: record.reportMetadataReportId,
        domain: record.policyPublishedDomain,
        sourceIP: record.recordRowSourceIP,
        count: record.recordRowCount
      })
    })
    
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = this.generateSignature(timestamp, 'POST', '/database/collection/dmarc_reports/batchAdd')
      console.log('🔐 Generated signature for timestamp:', timestamp)
      
      const currentTime = Date.now()
      const recordsWithTimestamp = records.map(record => ({
        ...record,
        createTime: currentTime,
        updateTime: currentTime,
      }))
      console.log('⏰ Added timestamps to all records')
      
      console.log('🚀 Sending batch insert request...')
      console.log('🌐 Request domain:', this.requestDomain)
      console.log('🆔 Space ID:', this.spaceId)
      console.log('📱 App ID:', this.spaceAppId)
      console.log('📦 Payload size:', JSON.stringify(recordsWithTimestamp).length, 'characters')

      const response = await fetch(`${this.requestDomain}/database/collection/dmarc_reports/batchAdd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CloudBase-SpaceId': this.spaceId,
          'X-CloudBase-AppId': this.spaceAppId,
          'X-CloudBase-Timestamp': timestamp.toString(),
          'X-CloudBase-Signature': signature,
        },
        body: JSON.stringify({
          data: recordsWithTimestamp,
        }),
      })

      console.log('📡 Batch insert response status:', response.status, response.statusText)
      console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Batch insert failed with response:', errorText)
        throw new Error(`Failed to batch insert records: ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📄 Batch insert response data:', JSON.stringify(data, null, 2))
      
      const insertedIds = data.ids || []
      console.log('🆔 Inserted record IDs:', insertedIds)
      console.log('📊 Successfully inserted', insertedIds.length, 'out of', records.length, 'records')
      console.log('✅ Batch insert completed successfully!')
      
      return insertedIds
    } catch (error) {
      console.error('💥 Batch insert records error:', error)
      console.error('📋 Error details:', {
        message: error.message,
        stack: error.stack,
        recordCount: records.length,
        firstRecordId: records[0]?.reportMetadataReportId
      })
      throw error
    }
  }

  // 查询CloudBase数据库数据
  async queryDmarcRecords(filter: any = {}, limit: number = 100): Promise<any[]> {
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = this.generateSignature(timestamp, 'POST', '/database/collection/dmarc_reports/get')
      
      const response = await fetch(`${this.requestDomain}/database/collection/dmarc_reports/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CloudBase-SpaceId': this.spaceId,
          'X-CloudBase-AppId': this.spaceAppId,
          'X-CloudBase-Timestamp': timestamp.toString(),
          'X-CloudBase-Signature': signature,
        },
        body: JSON.stringify({
          filter,
          limit,
          orderBy: {
            createTime: 'desc'
          }
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to query records: ${response.statusText}`)
      }

      const data = await response.json()
      return data.data || []
    } catch (error) {
      console.error('Query records error:', error)
      throw error
    }
  }
}
