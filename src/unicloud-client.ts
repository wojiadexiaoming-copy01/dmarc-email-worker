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
    const stringToSign = `${method}\n${path}\n${timestamp}`
    // 简化版签名，实际使用中需要HMAC-SHA256
    return btoa(`${this.accessKey}:${stringToSign}:${this.secretKey}`).substring(0, 32)
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
    try {
      // 生成文件路径
      const date = new Date()
      const filePath = `dmarc-reports/${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${filename}`
      
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = this.generateSignature(timestamp, 'POST', '/storage/upload')
      
      const formData = new FormData()
      const blob = content instanceof ArrayBuffer ? new Blob([content]) : new Blob([content])
      formData.append('file', blob, filename)
      formData.append('path', filePath)
      formData.append('spaceId', this.spaceId)

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

      if (!response.ok) {
        throw new Error(`Failed to upload file: ${response.statusText}`)
      }

      const data = await response.json()
      const fileUrl = data.fileUrl || data.url || `${this.downloadDomain}/${filePath}`
      return fileUrl
    } catch (error) {
      console.error('Upload file error:', error)
      throw error
    }
  }

  // 插入数据到CloudBase数据库
  async insertDmarcRecord(record: any): Promise<string> {
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = this.generateSignature(timestamp, 'POST', '/database/collection/dmarc_reports/add')
      
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
          data: {
            ...record,
            createTime: Date.now(),
            updateTime: Date.now(),
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to insert record: ${response.statusText}`)
      }

      const data = await response.json()
      return data.id || data._id || 'unknown'
    } catch (error) {
      console.error('Insert record error:', error)
      throw error
    }
  }

  // 批量插入数据到CloudBase数据库
  async batchInsertDmarcRecords(records: any[]): Promise<string[]> {
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = this.generateSignature(timestamp, 'POST', '/database/collection/dmarc_reports/batchAdd')
      
      const recordsWithTimestamp = records.map(record => ({
        ...record,
        createTime: Date.now(),
        updateTime: Date.now(),
      }))

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

      if (!response.ok) {
        throw new Error(`Failed to batch insert records: ${response.statusText}`)
      }

      const data = await response.json()
      return data.ids || []
    } catch (error) {
      console.error('Batch insert records error:', error)
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