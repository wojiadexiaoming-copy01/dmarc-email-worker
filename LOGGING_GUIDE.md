# 📊 Cloudflare Workers 日志查看指南

## 🎯 日志系统概述

你的DMARC Email Worker已经配置了超详细的日志系统，涵盖了整个处理流程的每一个步骤。

## 📋 日志分类

### 🚀 主流程日志
- `🚀 ===== DMARC Email Worker Started =====` - Worker启动
- `📧 Received email message at:` - 邮件接收时间
- `📨 Message from:` - 发件人信息
- `📬 Message to:` - 收件人信息
- `📝 Message subject:` - 邮件主题
- `📏 Message size:` - 邮件大小

### 🔧 邮件处理日志
- `🔧 ===== Starting Email Processing =====` - 开始处理邮件
- `📖 Step 1: Parsing email content...` - 解析邮件内容
- `📎 Step 2: Processing attachments...` - 处理附件
- `☁️ Step 3: Uploading file to CloudBase storage...` - 上传文件
- `🔍 Step 4: Parsing DMARC XML data...` - 解析XML数据
- `💾 Step 5: Saving data to CloudBase database...` - 保存数据

### 📄 附件处理日志
- `🔍 ===== Starting XML Parsing =====` - 开始XML解析
- `🗜️ Processing GZ compressed file...` - 处理GZ压缩文件
- `📦 Processing ZIP compressed file...` - 处理ZIP压缩文件
- `📄 Processing plain XML file...` - 处理纯XML文件

### ☁️ CloudBase操作日志
- `☁️ ===== CloudBase File Upload =====` - 文件上传
- `💾 ===== CloudBase Single Record Insert =====` - 单条记录插入
- `💾 ===== CloudBase Batch Insert =====` - 批量插入
- `🔐 Generating signature...` - 生成签名
- `📤 Preparing upload request...` - 准备上传请求
- `🚀 Sending upload request...` - 发送上传请求

### 📊 数据处理日志
- `📊 ===== Processing DMARC Report Data =====` - 处理DMARC数据
- `🔍 Validating report structure...` - 验证报告结构
- `📊 Report metadata:` - 报告元数据
- `🛡️ Policy published:` - 发布策略
- `📈 Processing X record(s)...` - 处理记录数量

## 🔍 如何查看日志

### 方法1：Cloudflare Dashboard
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择你的账户和域名
3. 进入 **Workers & Pages**
4. 点击你的 `dmarc-email-worker`
5. 点击 **Logs** 标签页
6. 选择时间范围查看实时日志

### 方法2：Wrangler CLI
```bash
# 实时查看日志
npx wrangler tail dmarc-email-worker

# 查看特定时间范围的日志
npx wrangler tail dmarc-email-worker --since 2024-01-01T00:00:00Z

# 过滤特定级别的日志
npx wrangler tail dmarc-email-worker --level error
```

### 方法3：通过API
```bash
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{script_name}/logs" \
  -H "Authorization: Bearer {api_token}"
```

## 📈 日志分析要点

### ✅ 成功处理的标志
- `✅ ===== DMARC Email Worker Completed Successfully =====`
- `✅ File uploaded successfully to CloudBase!`
- `✅ XML parsed successfully`
- `✅ Successfully inserted X records to CloudBase database`

### ❌ 错误处理的标志
- `❌ ===== DMARC Email Worker Failed =====`
- `❌ No attachments found in email`
- `❌ Failed to upload file to CloudBase:`
- `❌ Batch insert failed:`
- `❌ Unknown file extension:`

### ⚠️ 警告信息
- `⚠️ Some records failed to insert, but X were successful`
- `🔄 Attempting individual record inserts as fallback...`

## 🛠️ 故障排除

### 1. 邮件接收问题
查找日志：`📧 Received email message at:`
- 如果没有此日志，检查Email Routing配置
- 确认DMARC记录中的邮箱地址正确

### 2. 附件处理问题
查找日志：`📎 Step 2: Processing attachments...`
- `❌ No attachments found in email` - 邮件没有附件
- `❌ Unknown file extension:` - 不支持的文件格式

### 3. CloudBase连接问题
查找日志：`☁️ ===== CloudBase File Upload =====`
- `❌ Upload failed with response:` - 上传失败
- `❌ Insert failed with response:` - 数据库插入失败
- 检查硬编码的CloudBase配置是否正确

### 4. XML解析问题
查找日志：`🔍 ===== Starting XML Parsing =====`
- `❌ Invalid XML structure` - XML格式不正确
- `❌ No entries found in ZIP file` - ZIP文件为空

## 📊 性能监控

### 关键指标
- **处理时间**：从 `Worker Started` 到 `Completed Successfully` 的时间
- **文件大小**：`📏 Message size:` 和 `📏 Content size:`
- **记录数量**：`📈 Processing X record(s)...`
- **成功率**：成功/失败的比例

### 优化建议
1. **大文件处理**：如果文件很大，考虑增加Worker的CPU时间限制
2. **批量插入**：优先使用批量插入，失败时自动降级为单条插入
3. **错误重试**：对于临时性错误，可以考虑添加重试机制

## 🔔 告警设置

建议设置以下告警：
1. **Worker执行失败**：`❌ ===== DMARC Email Worker Failed =====`
2. **CloudBase连接失败**：`❌ Upload failed` 或 `❌ Insert failed`
3. **处理时间过长**：超过预期的处理时间

## 📝 日志示例

### 成功处理的完整日志流程：
```
🚀 ===== DMARC Email Worker Started =====
📧 Received email message at: 2024-01-15T10:30:00.000Z
📨 Message from: noreply@google.com
📬 Message to: dmarc@yydsoi.edu.kg
📝 Message subject: Report Domain: yydsoi.edu.kg
📏 Message size: 15234 bytes

🔧 ===== Starting Email Processing =====
📖 Step 1: Parsing email content...
✅ Email parsed successfully
📎 Step 2: Processing attachments...
📄 Attachment details:
  - Filename: google.com!yydsoi.edu.kg!1642204800!1642291200.xml.gz
  - MIME type: application/gzip
  - Size: 1234 bytes

☁️ Step 3: Uploading file to CloudBase storage...
✅ File uploaded successfully to CloudBase!
🔗 File URL: https://env-00jxt0xsffn5.normal.cloudstatic.cn/dmarc-reports/2024/1/google.com!yydsoi.edu.kg!1642204800!1642291200.xml.gz

🔍 Step 4: Parsing DMARC XML data...
✅ XML parsed successfully
📊 Report metadata:
  - Org name: google.com
  - Report ID: 12345678901234567890
  - Domain: yydsoi.edu.kg

💾 Step 5: Saving data to CloudBase database...
🎉 Batch insert successful!
📊 Successfully inserted 3 records to CloudBase database

✅ ===== DMARC Email Worker Completed Successfully =====
```

这个日志系统将帮助你完全了解Worker的运行状态和CloudBase的连接情况！