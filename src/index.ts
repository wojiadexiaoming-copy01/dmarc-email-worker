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
    console.log('🚀 ===== DMARC Email Worker Started =====')
    console.log('📧 Received email message at:', new Date().toISOString())
    console.log('📨 Message from:', message.from)
    console.log('📬 Message to:', message.to)
    console.log('📝 Message subject:', message.headers.get('subject') || 'No subject')
    console.log('📏 Message size:', message.raw.length, 'bytes')

    try {
      await handleEmail(message, env, ctx)
      console.log('✅ ===== DMARC Email Worker Completed Successfully =====')
    } catch (error) {
      console.error('❌ ===== DMARC Email Worker Failed =====')
      console.error('💥 Error details:', error)
      throw error
    }
  },
}

async function handleEmail(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('🔧 ===== Starting Email Processing =====')

  const parser = new PostalMime.default()
  console.log('📦 Initialized PostalMime parser')

  try {
    // 解析邮件内容
    console.log('📖 Step 1: Parsing email content...')
    const rawEmail = new Response(message.raw)
    const email = await parser.parse(await rawEmail.arrayBuffer())
    console.log('✅ Email parsed successfully')
    console.log('📧 Email details:')
    console.log('  - From:', email.from?.address || 'Unknown')
    console.log('  - Subject:', email.subject || 'No subject')
    console.log('  - Date:', email.date || 'No date')
    console.log('  - Attachments count:', email.attachments?.length || 0)

    // 获取附件
    console.log('📎 Step 2: Processing attachments...')
    if (email.attachments === null || email.attachments.length === 0) {
      console.error('❌ No attachments found in email')
      throw new Error('no attachments')
    }

    const attachment = email.attachments[0]
    console.log('📄 Attachment details:')
    console.log('  - Filename:', attachment.filename)
    console.log('  - MIME type:', attachment.mimeType)
    console.log('  - Size:', typeof attachment.content === 'string' ? attachment.content.length : attachment.content.byteLength, 'bytes')
    console.log('  - Disposition:', attachment.disposition)

    // 解析XML获取DMARC报告数据
    console.log('🔍 Step 3: Parsing DMARC XML data...')
    const reportJSON = await getDMARCReportXML(attachment)
    console.log('✅ XML parsed successfully')
    console.log('📊 Report metadata:')
    console.log('  - Org name:', reportJSON?.feedback?.report_metadata?.org_name || 'Unknown')
    console.log('  - Report ID:', reportJSON?.feedback?.report_metadata?.report_id || 'Unknown')
    console.log('  - Domain:', reportJSON?.feedback?.policy_published?.domain || 'Unknown')

    const reportRows = getReportRows(reportJSON)
    console.log('📈 Extracted', reportRows.length, 'DMARC records from report')

    // 调用UniCloud云函数处理数据
    console.log('☁️ Step 4: Calling UniCloud function to process data...')
    await callUniCloudFunction(email, attachment, reportRows)

    console.log('🎉 Successfully processed DMARC report with', reportRows.length, 'records')
  } catch (error) {
    console.error('💥 Error in handleEmail:', error)
    console.error('📋 Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    throw error
  }
}

async function getDMARCReportXML(attachment: Attachment) {
  console.log('🔍 ===== Starting XML Parsing =====')
  console.log('📄 Attachment MIME type:', attachment.mimeType)

  let xml
  const xmlParser = new XMLParser()
  const extension = mimeDb[attachment.mimeType]?.extensions?.[0] || ''
  console.log('📝 Detected file extension:', extension || 'unknown')

  try {
    switch (extension) {
      case 'gz':
        console.log('🗜️ Processing GZ compressed file...')
        xml = pako.inflate(new TextEncoder().encode(attachment.content as string), { to: 'string' })
        console.log('✅ GZ file decompressed successfully')
        console.log('📏 Decompressed XML size:', xml.length, 'characters')
        break

      case 'zip':
        console.log('📦 Processing ZIP compressed file...')
        xml = await getXMLFromZip(attachment.content)
        console.log('✅ ZIP file extracted successfully')
        console.log('📏 Extracted XML size:', xml.length, 'characters')
        break

      case 'xml':
        console.log('📄 Processing plain XML file...')
        xml = await new Response(attachment.content).text()
        console.log('✅ XML file read successfully')
        console.log('📏 XML size:', xml.length, 'characters')
        break

      default:
        console.error('❌ Unknown file extension:', extension)
        console.error('📋 MIME type:', attachment.mimeType)
        throw new Error(`unknown extension: ${extension}`)
    }

    console.log('🔄 Parsing XML content...')
    const parsedXML = await xmlParser.parse(xml)
    console.log('✅ XML parsed successfully')
    console.log('📊 XML structure preview:', JSON.stringify(parsedXML, null, 2).substring(0, 500) + '...')

    return parsedXML
  } catch (error) {
    console.error('💥 Error in getDMARCReportXML:', error)
    console.error('📋 Error details:', {
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
  console.log('📦 ===== Extracting ZIP File =====')

  try {
    console.log('🔄 Unzipping content...')
    const { entries } = await unzipit.unzipRaw(content)
    console.log('📁 ZIP entries found:', entries.length)

    if (entries.length === 0) {
      console.error('❌ No entries found in ZIP file')
      throw new Error('no entries in zip')
    }

    // 列出所有条目
    entries.forEach((entry, index) => {
      console.log(`📄 Entry ${index + 1}:`, entry.name, `(${entry.size} bytes)`)
    })

    console.log('📖 Reading first entry content...')
    const xmlContent = await entries[0].text()
    console.log('✅ ZIP entry extracted successfully')
    console.log('📏 Extracted content size:', xmlContent.length, 'characters')

    return xmlContent
  } catch (error) {
    console.error('💥 Error in getXMLFromZip:', error)
    console.error('📋 Error details:', {
      message: error.message,
      contentType: typeof content,
      contentSize: content instanceof ArrayBuffer ? content.byteLength : 'unknown'
    })
    throw error
  }
}

function getReportRows(report: any): DmarcRecordRow[] {
  console.log('📊 ===== Processing DMARC Report Data =====')

  try {
    console.log('🔍 Validating report structure...')
    const reportMetadata = report.feedback?.report_metadata
    const policyPublished = report.feedback?.policy_published
    const records = Array.isArray(report.feedback?.record) ? report.feedback.record : [report.feedback?.record]

    console.log('📋 Report validation:')
    console.log('  - Has feedback:', !!report.feedback)
    console.log('  - Has metadata:', !!reportMetadata)
    console.log('  - Has policy:', !!policyPublished)
    console.log('  - Has records:', !!records && records.length > 0)

    if (!report.feedback || !reportMetadata || !policyPublished || !records) {
      console.error('❌ Invalid XML structure')
      console.error('📋 Missing components:', {
        feedback: !report.feedback,
        metadata: !reportMetadata,
        policy: !policyPublished,
        records: !records
      })
      throw new Error('invalid xml')
    }

    console.log('📊 Report metadata:')
    console.log('  - Report ID:', reportMetadata.report_id)
    console.log('  - Organization:', reportMetadata.org_name)
    console.log('  - Date range:', reportMetadata.date_range?.begin, 'to', reportMetadata.date_range?.end)

    console.log('🛡️ Policy published:')
    console.log('  - Domain:', policyPublished.domain)
    console.log('  - Policy:', policyPublished.p)
    console.log('  - Percentage:', policyPublished.pct)
    console.log('  - DKIM alignment:', policyPublished.adkim)
    console.log('  - SPF alignment:', policyPublished.aspf)

    console.log('📈 Processing', records.length, 'record(s)...')
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
  attachment: Attachment,
  reportRows: DmarcRecordRow[]
): Promise<void> {
  console.log('☁️ ===== Calling UniCloud Function =====')
  console.log('� Retcords to process:', reportRows.length)
  console.log('📄 Attachment filename:', attachment.filename)
  console.log('📏 Attachment size:', typeof attachment.content === 'string' ? attachment.content.length : attachment.content.byteLength, 'bytes')

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
      
      // 附件信息
      attachment: {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        content: attachment.content, // 原始内容，云函数会处理
        size: typeof attachment.content === 'string' ? attachment.content.length : attachment.content.byteLength
      },
      
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
    console.log('  - Attachment filename:', payload.attachment.filename)
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