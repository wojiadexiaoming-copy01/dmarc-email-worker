# uniCloud数据库结构说明

## 集合名称
`dmarc_reports`

## 字段说明

### 报告元数据
- `reportMetadataReportId` (String): 报告唯一标识符
- `reportMetadataOrgName` (String): 发送报告的组织名称
- `reportMetadataDateRangeBegin` (Number): 报告时间范围开始（Unix时间戳）
- `reportMetadataDateRangeEnd` (Number): 报告时间范围结束（Unix时间戳）
- `reportMetadataError` (String): 报告错误信息（JSON格式）

### 发布策略
- `policyPublishedDomain` (String): 域名
- `policyPublishedADKIM` (Number): DKIM对齐方式 (0=宽松, 1=严格)
- `policyPublishedASPF` (Number): SPF对齐方式 (0=宽松, 1=严格)
- `policyPublishedP` (Number): 主域策略 (0=none, 1=quarantine, 2=reject)
- `policyPublishedSP` (Number): 子域策略 (0=none, 1=quarantine, 2=reject)
- `policyPublishedPct` (Number): 策略应用百分比 (0-100)

### 记录详情
- `recordRowSourceIP` (String): 发送邮件的源IP地址
- `recordRowCount` (Number): 该IP发送的邮件数量
- `recordRowPolicyEvaluatedDKIM` (Number): DKIM验证结果 (0=fail, 1=pass)
- `recordRowPolicyEvaluatedSPF` (Number): SPF验证结果 (0=fail, 1=pass)
- `recordRowPolicyEvaluatedDisposition` (Number): 邮件处理方式 (0=none, 1=quarantine, 2=reject)
- `recordRowPolicyEvaluatedReasonType` (Number): 策略覆盖原因类型

### 标识符
- `recordIdentifiersEnvelopeTo` (String): 信封收件人地址
- `recordIdentifiersHeaderFrom` (String): 邮件头发件人地址

### 系统字段
- `_id` (String): 数据库记录唯一ID
- `attachmentUrl` (String): 原始附件在云存储中的URL
- `createTime` (Number): 记录创建时间（Unix时间戳）
- `updateTime` (Number): 记录更新时间（Unix时间戳）

## 建议的数据库索引

为了提高查询性能，建议创建以下索引：

```javascript
// 1. 按创建时间排序的索引
db.collection('dmarc_reports').createIndex({
  createTime: -1
})

// 2. 按域名查询的索引
db.collection('dmarc_reports').createIndex({
  policyPublishedDomain: 1
})

// 3. 按报告ID查询的索引
db.collection('dmarc_reports').createIndex({
  reportMetadataReportId: 1
})

// 4. 按时间范围查询的复合索引
db.collection('dmarc_reports').createIndex({
  reportMetadataDateRangeBegin: 1,
  reportMetadataDateRangeEnd: 1
})

// 5. 按源IP查询的索引
db.collection('dmarc_reports').createIndex({
  recordRowSourceIP: 1
})
```

## 常用查询示例

```javascript
// 查询最近的报告
db.collection('dmarc_reports')
  .orderBy('createTime', 'desc')
  .limit(20)
  .get()

// 查询特定域名的报告
db.collection('dmarc_reports')
  .where({
    policyPublishedDomain: 'example.com'
  })
  .get()

// 查询失败的DKIM验证
db.collection('dmarc_reports')
  .where({
    recordRowPolicyEvaluatedDKIM: 0
  })
  .get()

// 查询被拒绝的邮件
db.collection('dmarc_reports')
  .where({
    recordRowPolicyEvaluatedDisposition: 2
  })
  .get()

// 按时间范围查询
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
db.collection('dmarc_reports')
  .where({
    createTime: db.command.gte(oneDayAgo)
  })
  .get()

// 统计查询 - 按域名分组统计邮件数量
db.collection('dmarc_reports')
  .aggregate()
  .group({
    _id: '$policyPublishedDomain',
    totalCount: db.command.aggregate.sum('$recordRowCount'),
    reportCount: db.command.aggregate.sum(1)
  })
  .end()
```