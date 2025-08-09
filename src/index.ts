import * as PostalMime from 'postal-mime'
import * as mimeDb from 'mime-db'

import * as unzipit from 'unzipit'
import * as pako from 'pako'

import { XMLParser } from 'fast-xml-parser'

import {
  Env,
  Attachment,
  DmarcRecordRow,
  DmarcDatabaseRecord,
  AlignmentType,
  DispositionType,
  DMARCResultType,
  PolicyOverrideType,
} from './types'

// 移除UniCloudClient导入，改为直接HTTP调用

export default {
  async email(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('🚀 ===== 邮件处理器启动 =====')
    console.log('📧 收到邮件时间:', new Date().toISOString())
    console.log('📨 发件人:', message.from)
    console.log('📬 收件人:', message.to)
    console.log('📝 邮件主题:', message.headers.get('subject') || '无主题')
    console.log('📏 邮件大小:', message.raw.length, '字节')

    try {
      await handleEmail(message, env, ctx)
      console.log('✅ ===== 邮件处理完成 =====')
    } catch (error) {
      console.error('❌ ===== 邮件处理失败 =====')
      console.error('💥 错误详情:', error)
      throw error
    }
  },
}

async function handleEmail(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('🔧 ===== 开始处理邮件 =====')

  const parser = new PostalMime.default()
  console.log('📦 初始化邮件解析器')

  try {
    // 解析邮件内容
    console.log('📖 步骤1: 解析邮件内容...')
    const rawEmail = new Response(message.raw)
    const email = await parser.parse(await rawEmail.arrayBuffer())
    console.log('✅ 邮件解析成功')
    console.log('📧 邮件详情:')
    console.log('  - 发件人:', email.from?.address || '未知')
    console.log('  - 主题:', email.subject || '无主题')
    console.log('  - 日期:', email.date || '无日期')
    console.log('  - 附件数量:', email.attachments?.length || 0)

    // 处理附件（如果有的话）
    console.log('📎 步骤2: 处理附件...')
    let attachment = null
    let reportRows: DmarcRecordRow[] = []

    if (email.attachments && email.attachments.length > 0) {
      console.log('📄 发现', email.attachments.length, '个附件')
      attachment = email.attachments[0]
      console.log('📄 附件详情:')
      console.log('  - 文件名:', attachment.filename)
      console.log('  - MIME类型:', attachment.mimeType)
      console.log('  - 大小:', typeof attachment.content === 'string' ? attachment.content.length : attachment.content.byteLength, '字节')
      console.log('  - 处理方式:', attachment.disposition)

      // 尝试解析XML获取DMARC报告数据（如果是DMARC报告的话）
      console.log('🔍 步骤3: 尝试解析附件为DMARC报告...')
      try {
        const reportJSON = await getDMARCReportXML(attachment)
        console.log('✅ 成功解析为DMARC报告')
        console.log('📊 报告元数据:')
        console.log('  - 组织名称:', reportJSON?.feedback?.report_metadata?.org_name || '未知')
        console.log('  - 报告ID:', reportJSON?.feedback?.report_metadata?.report_id || '未知')
        console.log('  - 域名:', reportJSON?.feedback?.policy_published?.domain || '未知')

        reportRows = getReportRows(reportJSON)
        console.log('📈 从报告中提取了', reportRows.length, '条DMARC记录')
      } catch (parseError) {
        console.log('ℹ️ 附件不是有效的DMARC报告，作为普通邮件附件处理')
        console.log('📋 解析错误:', parseError.message)
        // 继续处理，只是没有DMARC数据
      }
    } else {
      console.log('ℹ️ 未发现附件，作为普通邮件处理')
    }

    // 调用UniCloud云函数处理数据（无论是否有附件都调用）
    console.log('☁️ 步骤4: 调用云函数处理邮件数据...')
    await callUniCloudFunction(email, attachment, reportRows)

    console.log('🎉 邮件处理成功，共处理', reportRows.length, '条记录')
  } catch (error) {
    console.error('💥 邮件处理出错:', error)
    console.error('📋 错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    throw error
  }
}

async function getDMARCReportXML(attachment: Attachment) {
  console.log('🔍 ===== 开始解析XML =====')
  console.log('📄 附件MIME类型:', attachment.mimeType)

  let xml
  const xmlParser = new XMLParser()
  const extension = mimeDb[attachment.mimeType]?.extensions?.[0] || ''
  console.log('📝 检测到文件扩展名:', extension || '未知')

  try {
    switch (extension) {
      case 'gz':
        console.log('🗜️ 处理GZ压缩文件...')
        xml = pako.inflate(new TextEncoder().encode(attachment.content as string), { to: 'string' })
        console.log('✅ GZ文件解压成功')
        console.log('📏 解压后XML大小:', xml.length, '字符')
        break

      case 'zip':
        console.log('📦 处理ZIP压缩文件...')
        xml = await getXMLFromZip(attachment.content)
        console.log('✅ ZIP文件提取成功')
        console.log('📏 提取的XML大小:', xml.length, '字符')
        break

      case 'xml':
        console.log('📄 处理纯XML文件...')
        xml = await new Response(attachment.content).text()
        console.log('✅ XML文件读取成功')
        console.log('📏 XML大小:', xml.length, '字符')
        break

      default:
        console.error('❌ 未知文件扩展名:', extension)
        console.error('📋 MIME类型:', attachment.mimeType)
        throw new Error(`未知扩展名: ${extension}`)
    }

    console.log('🔄 解析XML内容...')
    const parsedXML = await xmlParser.parse(xml)
    console.log('✅ XML解析成功')
    console.log('📊 XML结构预览:', JSON.stringify(parsedXML, null, 2).substring(0, 500) + '...')

    return parsedXML
  } catch (error) {
    console.error('💥 XML解析出错:', error)
    console.error('📋 错误详情:', {
      message: error.message,
      extension: extension,
      mimeType: attachment.mimeType,
      contentType: typeof attachment.content,
      contentSize: typeof attachment.content === 'string' ? attachment.content.length : attachment.content.byteLength
    })
    throw error
  }
}

async function getXMLFromZip(content: string | ArrayBuffer | Blob | unzipit.TypedArray | unzipit.Reader) {
  console.log('📦 ===== 提取ZIP文件 =====')

  try {
    console.log('🔄 解压内容...')
    const { entries } = await unzipit.unzipRaw(content)
    console.log('📁 发现ZIP条目:', entries.length, '个')

    if (entries.length === 0) {
      console.error('❌ ZIP文件中未发现条目')
      throw new Error('ZIP文件为空')
    }

    // 列出所有条目
    entries.forEach((entry, index) => {
      console.log(`📄 条目 ${index + 1}:`, entry.name, `(${entry.size} 字节)`)
    })

    console.log('📖 读取第一个条目内容...')
    const xmlContent = await entries[0].text()
    console.log('✅ ZIP条目提取成功')
    console.log('📏 提取内容大小:', xmlContent.length, '字符')

    return xmlContent
  } catch (error) {
    console.error('💥 ZIP提取出错:', error)
    console.error('📋 错误详情:', {
      message: error.message,
      contentType: typeof content,
      contentSize: content instanceof ArrayBuffer ? content.byteLength : '未知'
    })
    throw error
  }
}

function getReportRows(report: any): DmarcRecordRow[] {
  console.log('📊 ===== 处理DMARC报告数据 =====')

  try {
    console.log('🔍 验证报告结构...')
    const reportMetadata = report.feedback?.report_metadata
    const policyPublished = report.feedback?.policy_published
    const records = Array.isArray(report.feedback?.record) ? report.feedback.record : [report.feedback?.record]

    console.log('📋 报告验证:')
    console.log('  - 有反馈数据:', !!report.feedback)
    console.log('  - 有元数据:', !!reportMetadata)
    console.log('  - 有策略:', !!policyPublished)
    console.log('  - 有记录:', !!records && records.length > 0)

    if (!report.feedback || !reportMetadata || !policyPublished || !records) {
      console.error('❌ 无效的XML结构')
      console.error('📋 缺少组件:', {
        feedback: !report.feedback,
        metadata: !reportMetadata,
        policy: !policyPublished,
        records: !records
      })
      throw new Error('无效的XML')
    }

    console.log('📊 报告元数据:')
    console.log('  - 报告ID:', reportMetadata.report_id)
    console.log('  - 组织:', reportMetadata.org_name)
    console.log('  - 日期范围:', reportMetadata.date_range?.begin, '到', reportMetadata.date_range?.end)

    console.log('🛡️ 发布策略:')
    console.log('  - 域名:', policyPublished.domain)
    console.log('  - 策略:', policyPublished.p)
    console.log('  - 百分比:', policyPublished.pct)
    console.log('  - DKIM对齐:', policyPublished.adkim)
    console.log('  - SPF对齐:', policyPublished.aspf)

    console.log('📈 处理', records.length, '条记录...')
    const listEvents: DmarcRecordRow[] = []

    for (let index = 0; index < records.length; index++) {
      const record = records[index]
      console.log(`🔄 Processing record ${index + 1}/${records.length}`)
      console.log('  - Source IP:', record.row?.source_ip)
      console.log('  - Count:', record.row?.count)
      console.log('  - DKIM result:', record.row?.policy_evaluated?.dkim)
      console.log('  - SPF result:', record.row?.policy_evaluated?.spf)
      console.log('  - Disposition:', record.row?.policy_evaluated?.disposition)

      const reportRow: DmarcRecordRow = {
        reportMetadataReportId: reportMetadata.report_id?.toString().replace('-', '_') || '',
        reportMetadataOrgName: reportMetadata.org_name || '',
        reportMetadataDateRangeBegin: parseInt(reportMetadata.date_range?.begin) || 0,
        reportMetadataDateRangeEnd: parseInt(reportMetadata.date_range?.end) || 0,
        reportMetadataError: JSON.stringify(reportMetadata.error) || '',

        policyPublishedDomain: policyPublished.domain || '',
        policyPublishedADKIM: AlignmentType[policyPublished.adkim as keyof typeof AlignmentType] || 0,
        policyPublishedASPF: AlignmentType[policyPublished.aspf as keyof typeof AlignmentType] || 0,
        policyPublishedP: DispositionType[policyPublished.p as keyof typeof DispositionType] || 0,
        policyPublishedSP: DispositionType[policyPublished.sp as keyof typeof DispositionType] || 0,
        policyPublishedPct: parseInt(policyPublished.pct) || 0,

        recordRowSourceIP: record.row?.source_ip || '',
        recordRowCount: parseInt(record.row?.count) || 0,
        recordRowPolicyEvaluatedDKIM: DMARCResultType[record.row?.policy_evaluated?.dkim as keyof typeof DMARCResultType] || 0,
        recordRowPolicyEvaluatedSPF: DMARCResultType[record.row?.policy_evaluated?.spf as keyof typeof DMARCResultType] || 0,
        recordRowPolicyEvaluatedDisposition:
          DispositionType[record.row?.policy_evaluated?.disposition as keyof typeof DispositionType] || 0,

        recordRowPolicyEvaluatedReasonType:
          PolicyOverrideType[record.row?.policy_evaluated?.reason?.type as keyof typeof PolicyOverrideType] || 0,
        recordIdentifiersEnvelopeTo: record.identifiers?.envelope_to || '',
        recordIdentifiersHeaderFrom: record.identifiers?.header_from || '',
      }

      listEvents.push(reportRow)
      console.log(`✅ Record ${index + 1} processed successfully`)
    }

    console.log('🎉 All records processed successfully!')
    console.log('📊 Total records created:', listEvents.length)
    return listEvents
  } catch (error) {
    console.error('💥 Error in getReportRows:', error)
    console.error('📋 Error details:', {
      message: error.message,
      reportStructure: JSON.stringify(report, null, 2).substring(0, 1000) + '...'
    })
    throw error
  }
}

// 调用UniCloud云函数处理邮件数据
async function callUniCloudFunction(
  email: any,
  attachment: Attachment | null,
  reportRows: DmarcRecordRow[]
): Promise<void> {
  console.log('☁️ ===== 调用云函数 =====')
  console.log('� Retcords to process:', reportRows.length)
  console.log('📄 Has attachment:', !!attachment)
  if (attachment) {
    console.log('📄 Attachment filename:', attachment.filename)
    console.log('📏 Attachment size:', typeof attachment.content === 'string' ? attachment.content.length : attachment.content.byteLength, 'bytes')
  }

  const cloudFunctionUrl = 'https://env-00jxt0xsffn5.dev-hz.cloudbasefunction.cn/POST_cloudflare_edukg_email'

  try {
    // 准备发送给云函数的数据
    const payload = {
      // 邮件基本信息
      emailInfo: {
        from: email.from?.address || 'unknown',
        to: email.to?.map((addr: any) => addr.address) || [],
        subject: email.subject || 'No subject',
        date: email.date || new Date().toISOString(),
        messageId: email.messageId || 'unknown'
      },

      // 附件信息（如果有的话）
      attachment: attachment ? {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        content: attachment.content, // 原始内容，云函数会处理
        size: typeof attachment.content === 'string' ? attachment.content.length : attachment.content.byteLength
      } : null,

      // 解析后的DMARC数据
      dmarcRecords: reportRows,

      // 处理时间戳
      processedAt: new Date().toISOString(),

      // Worker信息
      workerInfo: {
        version: '1.0.0',
        source: 'cloudflare-workers'
      }
    }

    console.log('📦 Payload summary:')
    console.log('  - Email from:', payload.emailInfo.from)
    console.log('  - Email subject:', payload.emailInfo.subject)
    console.log('  - Has attachment:', !!payload.attachment)
    if (payload.attachment) {
      console.log('  - Attachment filename:', payload.attachment.filename)
    }
    console.log('  - DMARC records count:', payload.dmarcRecords.length)
    console.log('  - Payload size:', JSON.stringify(payload).length, 'characters')

    console.log('🚀 Sending request to UniCloud function...')
    console.log('🌐 Function URL:', cloudFunctionUrl)

    const response = await fetch(cloudFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Workers-DMARC-Processor/1.0'
      },
      body: JSON.stringify(payload)
    })

    console.log('📡 Response status:', response.status, response.statusText)
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()))

    if (response.ok) {
      const result = await response.json()
      console.log('✅ UniCloud function executed successfully!')
      console.log('📄 Response data:', JSON.stringify(result, null, 2))

      // 记录处理结果
      if (result.success) {
        console.log('🎉 Data processing completed successfully!')
        if (result.uploadedFileUrl) {
          console.log('📁 File uploaded to:', result.uploadedFileUrl)
        }
        if (result.insertedRecords) {
          console.log('💾 Database records inserted:', result.insertedRecords)
        }
        if (result.processingTime) {
          console.log('⏱️ Processing time:', result.processingTime, 'ms')
        }
      } else {
        console.warn('⚠️ Function executed but reported errors:', result.error || 'Unknown error')
      }
    } else {
      const errorText = await response.text()
      console.error('❌ UniCloud function call failed!')
      console.error('📋 Error response:', errorText)
      throw new Error(`UniCloud function failed: ${response.status} ${response.statusText} - ${errorText}`)
    }
  } catch (error) {
    console.error('💥 Error calling UniCloud function:', error)
    console.error('📋 Error details:', {
      message: error.message,
      stack: error.stack,
      functionUrl: cloudFunctionUrl,
      recordCount: reportRows.length
    })
    throw error
  }
}
