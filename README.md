# dmarc-email-worker (CloudBase版本)

一个部署在Cloudflare Workers上的DMARC报告处理脚本，使用腾讯云CloudBase云存储和数据库来存储和分析数据。

## 功能特性

- 接收和解析DMARC报告邮件
- 支持XML、ZIP、GZ格式的附件
- 将原始附件上传到CloudBase云存储
- 将解析后的数据保存到CloudBase数据库
- 自动错误处理和重试机制

## 技术栈

- [Cloudflare Workers](https://workers.cloudflare.com/) - 边缘计算平台
- [Email Workers](https://developers.cloudflare.com/email-routing/email-workers/) - 邮件处理
- [腾讯云CloudBase](https://cloud.tencent.com/product/tcb) - 云存储和数据库

## 安装配置

### 1. 克隆项目
```bash
git clone <repository-url>
cd dmarc-email-worker
```

### 2. 安装依赖
```bash
npm install
```

### 3. CloudBase配置
CloudBase配置已硬编码到代码中：
- SpaceId: `env-00jxt0xsffn5`
- SpaceAppId: `2021004134605314`
- 上传域名: `https://u.object.cloudrun.cloudbaseapp.cn`
- 下载域名: `https://env-00jxt0xsffn5.normal.cloudstatic.cn`
- 请求域名: `https://env-00jxt0xsffn5.api-hz.cloudbasefunction.cn`

### 4. 登录Cloudflare
```bash
npx wrangler login
```

### 5. 部署Worker
```bash
npx wrangler publish
```

### 6. 配置邮件路由
1. 在Cloudflare控制台配置Email Routing规则
2. 将DMARC报告邮件转发到此Worker
3. 在域名的DMARC记录中添加RUA地址

## 数据库结构

Worker会在uniCloud数据库中创建`dmarc_reports`集合，包含以下字段：

```javascript
{
  _id: "记录ID",
  reportMetadataReportId: "报告ID",
  reportMetadataOrgName: "组织名称",
  reportMetadataDateRangeBegin: "开始时间戳",
  reportMetadataDateRangeEnd: "结束时间戳",
  reportMetadataError: "错误信息",
  
  policyPublishedDomain: "域名",
  policyPublishedADKIM: "DKIM对齐方式",
  policyPublishedASPF: "SPF对齐方式",
  policyPublishedP: "主域策略",
  policyPublishedSP: "子域策略",
  policyPublishedPct: "策略百分比",
  
  recordRowSourceIP: "源IP地址",
  recordRowCount: "邮件数量",
  recordRowPolicyEvaluatedDKIM: "DKIM验证结果",
  recordRowPolicyEvaluatedSPF: "SPF验证结果",
  recordRowPolicyEvaluatedDisposition: "处理方式",
  recordRowPolicyEvaluatedReasonType: "策略覆盖原因",
  recordIdentifiersEnvelopeTo: "信封收件人",
  recordIdentifiersHeaderFrom: "头部发件人",
  
  attachmentUrl: "附件云存储URL",
  createTime: "创建时间",
  updateTime: "更新时间"
}
```

## 云存储结构

附件按以下路径存储在CloudBase云存储中：
```
dmarc-reports/
├── 2024/
│   ├── 1/
│   │   ├── report1.xml
│   │   └── report2.zip
│   └── 2/
│       └── report3.gz
└── 2025/
    └── 1/
        └── report4.xml
```

## 查询数据

可以通过CloudBase控制台或API查询数据：

```javascript
// 查询最近的报告
db.collection('dmarc_reports')
  .orderBy('createTime', 'desc')
  .limit(10)
  .get()

// 按域名查询
db.collection('dmarc_reports')
  .where({
    policyPublishedDomain: 'example.com'
  })
  .get()

// 按时间范围查询
db.collection('dmarc_reports')
  .where({
    createTime: db.command.gte(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
  })
  .get()
```

## 开发调试

```bash
# 本地开发
npm run start

# 代码检查
npm run lint

# 格式化代码
npm run pretty
```

## 错误处理

Worker包含完善的错误处理机制：
- 文件上传失败时继续处理数据
- 批量插入失败时自动切换到逐个插入
- 详细的错误日志记录

## 注意事项

1. 确保CloudBase空间有足够的存储和数据库配额
2. 定期清理旧的附件文件以节省存储空间
3. 监控Worker的执行日志以及时发现问题
4. 建议设置数据库索引以提高查询性能

## 许可证

MIT License