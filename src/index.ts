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

import { UniCloudClient } from './unicloud-client'

export default {
  async email(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleEmail(message, env, ctx)
  },
}

async function handleEmail(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
  const parser = new PostalMime.default()
  const uniCloudClient = new UniCloudClient(env)

  try {
    // 解析邮件内容
    const rawEmail = new Response(message.raw)
    const email = await parser.parse(await rawEmail.arrayBuffer())

    // 获取附件
    if (email.attachments === null || email.attachments.length === 0) {
      throw new Error('no attachments')
    }
    const attachment = email.attachments[0]

    // 上传附件到uniCloud云存储
    let attachmentUrl: string | undefined
    try {
      attachmentUrl = await uniCloudClient.uploadFile(attachment.filename, attachment.content)
      console.log(`File uploaded successfully: ${attachmentUrl}`)
    } catch (error) {
      console.error('Failed to upload file to uniCloud:', error)
      // 继续处理，即使上传失败
    }

    // 解析XML获取DMARC报告数据
    const reportJSON = await getDMARCReportXML(attachment)
    const reportRows = getReportRows(reportJSON)

    // 将数据保存到uniCloud数据库
    await saveToUniCloudDatabase(uniCloudClient, reportRows, attachmentUrl)

    console.log(`Successfully processed DMARC report with ${reportRows.length} records`)
  } catch (error) {
    console.error('Error processing email:', error)
    throw error
  }
}

async function getDMARCReportXML(attachment: Attachment) {
  let xml
  const xmlParser = new XMLParser()
  const extension = mimeDb[attachment.mimeType]?.extensions?.[0] || ''

  switch (extension) {
    case 'gz':
      xml = pako.inflate(new TextEncoder().encode(attachment.content as string), { to: 'string' })
      break

    case 'zip':
      xml = await getXMLFromZip(attachment.content)
      break

    case 'xml':
      xml = await new Response(attachment.content).text()
      break

    default:
      throw new Error(`unknown extension: ${extension}`)
  }

  return await xmlParser.parse(xml)
}

async function getXMLFromZip(content: string | ArrayBuffer | Blob | unzipit.TypedArray | unzipit.Reader) {
  const { entries } = await unzipit.unzipRaw(content)
  if (entries.length === 0) {
    throw new Error('no entries in zip')
  }

  return await entries[0].text()
}

function getReportRows(report: any): DmarcRecordRow[] {
  const reportMetadata = report.feedback.report_metadata
  const policyPublished = report.feedback.policy_published
  const records = Array.isArray(report.feedback.record) ? report.feedback.record : [report.feedback.record]

  if (!report.feedback || !reportMetadata || !policyPublished || !records) {
    throw new Error('invalid xml')
  }

  const listEvents: DmarcRecordRow[] = []

  for (let index = 0; index < records.length; index++) {
    const record = records[index]

    const reportRow: DmarcRecordRow = {
      reportMetadataReportId: reportMetadata.report_id.toString().replace('-', '_'),
      reportMetadataOrgName: reportMetadata.org_name || '',
      reportMetadataDateRangeBegin: parseInt(reportMetadata.date_range.begin) || 0,
      reportMetadataDateRangeEnd: parseInt(reportMetadata.date_range.end) || 0,
      reportMetadataError: JSON.stringify(reportMetadata.error) || '',

      policyPublishedDomain: policyPublished.domain || '',
      policyPublishedADKIM: AlignmentType[policyPublished.adkim as keyof typeof AlignmentType] || 0,
      policyPublishedASPF: AlignmentType[policyPublished.aspf as keyof typeof AlignmentType] || 0,
      policyPublishedP: DispositionType[policyPublished.p as keyof typeof DispositionType] || 0,
      policyPublishedSP: DispositionType[policyPublished.sp as keyof typeof DispositionType] || 0,
      policyPublishedPct: parseInt(policyPublished.pct) || 0,

      recordRowSourceIP: record.row.source_ip || '',
      recordRowCount: parseInt(record.row.count) || 0,
      recordRowPolicyEvaluatedDKIM: DMARCResultType[record.row.policy_evaluated.dkim as keyof typeof DMARCResultType] || 0,
      recordRowPolicyEvaluatedSPF: DMARCResultType[record.row.policy_evaluated.spf as keyof typeof DMARCResultType] || 0,
      recordRowPolicyEvaluatedDisposition:
        DispositionType[record.row.policy_evaluated.disposition as keyof typeof DispositionType] || 0,

      recordRowPolicyEvaluatedReasonType:
        PolicyOverrideType[record.row.policy_evaluated?.reason?.type as keyof typeof PolicyOverrideType] || 0,
      recordIdentifiersEnvelopeTo: record.identifiers.envelope_to || '',
      recordIdentifiersHeaderFrom: record.identifiers.header_from || '',
    }

    listEvents.push(reportRow)
  }

  return listEvents
}

async function saveToUniCloudDatabase(
  uniCloudClient: UniCloudClient, 
  reportRows: DmarcRecordRow[], 
  attachmentUrl?: string
): Promise<void> {
  try {
    // 将数据转换为数据库记录格式
    const databaseRecords: DmarcDatabaseRecord[] = reportRows.map(row => ({
      ...row,
      attachmentUrl,
      createTime: Date.now(),
      updateTime: Date.now(),
    }))

    // 批量插入数据
    const insertedIds = await uniCloudClient.batchInsertDmarcRecords(databaseRecords)
    console.log(`Successfully inserted ${insertedIds.length} records to uniCloud database`)
  } catch (error) {
    console.error('Failed to save to uniCloud database:', error)
    
    // 如果批量插入失败，尝试逐个插入
    console.log('Attempting individual inserts...')
    let successCount = 0
    
    for (const row of reportRows) {
      try {
        const databaseRecord: DmarcDatabaseRecord = {
          ...row,
          attachmentUrl,
          createTime: Date.now(),
          updateTime: Date.now(),
        }
        
        await uniCloudClient.insertDmarcRecord(databaseRecord)
        successCount++
      } catch (individualError) {
        console.error('Failed to insert individual record:', individualError)
      }
    }
    
    console.log(`Successfully inserted ${successCount} out of ${reportRows.length} records individually`)
    
    if (successCount === 0) {
      throw new Error('Failed to insert any records to database')
    }
  }
}