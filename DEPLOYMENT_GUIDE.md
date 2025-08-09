# 🚀 部署指南 - UniCloud + Cloudflare Workers

## 📋 架构概述

新的架构更简单、更安全：

```
📧 DMARC邮件 → Cloudflare Email Routing → Cloudflare Workers → UniCloud云函数 → 云存储 + 数据库
```

### 优势：
- ✅ **无需密钥管理**：Workers不需要存储任何CloudBase密钥
- ✅ **更好的安全性**：所有敏感操作在云函数内部完成
- ✅ **简化部署**：只需要一个HTTP调用
- ✅ **更好的错误处理**：云函数可以提供详细的错误信息
- ✅ **易于维护**：业务逻辑集中在云函数中

## 🎯 部署步骤

### 第一步：部署UniCloud云函数

#### 1. 使用HBuilderX部署
1. 打开HBuilderX
2. 创建或打开你的UniCloud项目
3. 将 `unicloud-function/POST_cloudflare_edukg_email/` 文件夹复制到你的项目的 `uniCloud-aliyun/cloudfunctions/` 目录下
4. 右键点击 `POST_cloudflare_edukg_email` 文件夹
5. 选择 "上传并运行"

#### 2. 验证云函数部署
部署成功后，云函数URL应该是：
```
https://env-00jxt0xsffn5.dev-hz.cloudbasefunction.cn/POST_cloudflare_edukg_email
```

#### 3. 测试云函数
```bash
cd test
node test-cloud-function.js
```

### 第二步：部署Cloudflare Workers

#### 1. 确保代码更新
确认以下文件已更新：
- ✅ `src/index.ts` - 移除了CloudBase直接调用，改为HTTP调用
- ✅ `src/types.ts` - 更新了类型定义
- ❌ `src/unicloud-client.ts` - 已删除，不再需要

#### 2. 部署Workers
```bash
npm install
npx wrangler login
npx wrangler publish
```

#### 3. 验证Workers部署
在Cloudflare Dashboard中检查Workers是否部署成功。

### 第三步：配置邮件路由

#### 1. 配置DNS DMARC记录
在你的域名DNS中添加：
```
_dmarc.yydsoi.edu.kg  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@yydsoi.edu.kg"
```

#### 2. 配置Cloudflare Email Routing
1. 进入Cloudflare Dashboard
2. 选择域名 `yydsoi.edu.kg`
3. 进入 Email → Email Routing
4. 添加路由规则：
   - **源地址**: `dmarc@yydsoi.edu.kg`
   - **目标**: Worker `getunicloud`

## 🧪 测试流程

### 1. 测试云函数连通性
```bash
cd test
node test-cloud-function.js
```

预期输出：
```
✅ Function call successful!
🎉 Data processing completed successfully!
📊 Processing results:
  - File uploaded: true
  - Records inserted: 2
  - Processing time: 1234 ms
```

### 2. 测试完整邮件流程
1. 发送测试DMARC报告邮件到 `dmarc@yydsoi.edu.kg`
2. 在Cloudflare Workers日志中查看处理过程
3. 在UniCloud控制台检查：
   - 云存储中是否有新文件
   - 数据库中是否有新记录

### 3. 查看日志
- **Cloudflare Workers日志**: `npx wrangler tail getunicloud`
- **UniCloud函数日志**: 在HBuilderX或UniCloud控制台查看

## 📊 数据结构

### UniCloud数据库集合：`cloudflare_edukg_email`

```javascript
{
  // DMARC数据
  reportMetadataReportId: "12345678901234567890",
  reportMetadataOrgName: "google.com",
  policyPublishedDomain: "yydsoi.edu.kg",
  recordRowSourceIP: "209.85.220.41",
  recordRowCount: 10,
  // ... 其他DMARC字段
  
  // 邮件信息
  emailFrom: "noreply@google.com",
  emailTo: ["dmarc@yydsoi.edu.kg"],
  emailSubject: "Report Domain: yydsoi.edu.kg",
  emailDate: "2024-01-15T10:30:00.000Z",
  emailMessageId: "message-id-123",
  
  // 附件信息
  attachmentFilename: "google.com!yydsoi.edu.kg!1642204800!1642291200.xml",
  attachmentMimeType: "application/xml",
  attachmentSize: 1234,
  attachmentUrl: "cloud://env-00jxt0xsffn5.xxx/cloudflare_edukg_email/2024/1/file.xml",
  
  // 系统字段
  createTime: 1642204800000,
  updateTime: 1642204800000,
  processedAt: "2024-01-15T10:30:00.000Z"
}
```

### 云存储路径结构
```
cloudflare_edukg_email/
├── 2024/
│   ├── 1/
│   │   ├── google.com!yydsoi.edu.kg!1642204800!1642291200.xml
│   │   └── microsoft.com!yydsoi.edu.kg!1642204801!1642291201.xml
│   └── 2/
│       └── yahoo.com!yydsoi.edu.kg!1642204802!1642291202.xml
└── 2025/
    └── 1/
        └── ...
```

## 🔍 故障排除

### 常见问题

#### 1. 云函数调用失败
**错误**: `Function call failed: 404 Not Found`
**解决**: 
- 检查云函数是否正确部署
- 确认函数名称是 `POST_cloudflare_edukg_email`
- 验证URL是否正确

#### 2. 文件上传失败
**错误**: `File upload failed`
**解决**:
- 检查UniCloud云存储权限
- 确认文件大小不超过限制
- 查看云函数日志获取详细错误

#### 3. 数据库插入失败
**错误**: `Database save failed`
**解决**:
- 检查数据库权限设置
- 确认集合 `cloudflare_edukg_email` 存在
- 检查数据格式是否正确

#### 4. Workers超时
**错误**: `Worker execution timeout`
**解决**:
- 检查云函数响应时间
- 优化云函数代码性能
- 考虑增加Workers超时时间

### 调试技巧

#### 1. 查看详细日志
```bash
# Cloudflare Workers日志
npx wrangler tail getunicloud

# 本地测试云函数
cd test
node test-cloud-function.js
```

#### 2. 检查网络连通性
```bash
curl -X POST https://env-00jxt0xsffn5.dev-hz.cloudbasefunction.cn/POST_cloudflare_edukg_email \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

#### 3. 验证数据格式
在云函数中添加更多日志来检查接收到的数据格式。

## 📈 性能优化

### 1. 云函数优化
- 使用批量数据库操作
- 优化文件上传逻辑
- 添加适当的错误重试机制

### 2. Workers优化
- 减少不必要的数据传输
- 优化JSON序列化
- 添加请求缓存（如果适用）

### 3. 监控指标
- 云函数执行时间
- 数据库操作耗时
- 文件上传成功率
- 整体处理成功率

## 🎉 部署完成检查清单

- [ ] UniCloud云函数部署成功
- [ ] 云函数测试通过
- [ ] Cloudflare Workers部署成功
- [ ] DNS DMARC记录配置正确
- [ ] Email Routing规则配置正确
- [ ] 端到端测试通过
- [ ] 日志监控正常
- [ ] 数据存储验证通过

完成所有检查项后，你的DMARC邮件处理系统就可以正常运行了！🚀