# 项目结构说明

## 完整项目文件列表

```
dmarc-email-worker/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions自动部署配置
├── src/
│   ├── index.ts               # 主要的Worker入口文件
│   ├── types.ts               # TypeScript类型定义
│   ├── unicloud-client.ts     # CloudBase API客户端
│   └── unicloud-database-schema.md  # 数据库结构说明
├── .gitignore                 # Git忽略文件配置
├── .prettierrc.json          # 代码格式化配置
├── LICENSE                   # MIT许可证
├── package.json              # Node.js依赖和脚本配置
├── README.md                 # 项目说明文档
├── tsconfig.json             # TypeScript编译配置
└── wrangler.toml             # Cloudflare Workers配置
```

## 核心文件说明

### 源代码文件 (src/)
- **index.ts**: 主要的邮件处理逻辑，包含邮件解析、附件处理、数据存储
- **types.ts**: 定义了所有的TypeScript接口和枚举类型
- **unicloud-client.ts**: 封装了与腾讯云CloudBase的API交互逻辑
- **unicloud-database-schema.md**: 数据库结构和查询示例文档

### 配置文件
- **wrangler.toml**: Cloudflare Workers的部署配置，包含硬编码的CloudBase参数
- **package.json**: 项目依赖、脚本和元信息
- **tsconfig.json**: TypeScript编译器配置
- **.prettierrc.json**: 代码格式化规则

### 部署文件
- **.github/workflows/deploy.yml**: GitHub Actions自动部署到Cloudflare Workers

## 硬编码的CloudBase配置

以下配置已直接写入代码中：
- SpaceId: `env-00jxt0xsffn5`
- SpaceAppId: `2021004134605314`
- AccessKey: `gah82pAcM7dq85Ih`
- SecretKey: `9QASalzyyRI5vs4q`
- 上传域名: `https://u.object.cloudrun.cloudbaseapp.cn`
- 下载域名: `https://env-00jxt0xsffn5.normal.cloudstatic.cn`
- 请求域名: `https://env-00jxt0xsffn5.api-hz.cloudbasefunction.cn`

## 部署方式

### 方式一：本地部署
```bash
npm install
npx wrangler login
npx wrangler publish
```

### 方式二：GitHub Actions自动部署
1. 推送代码到GitHub
2. 在仓库设置中添加Secrets：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. 推送到main分支自动触发部署

## 功能流程

1. **邮件接收**: Cloudflare Email Routing接收DMARC报告邮件
2. **Worker触发**: 自动调用部署的Worker
3. **邮件解析**: 解析邮件内容和附件（XML/ZIP/GZ）
4. **文件上传**: 将原始附件上传到CloudBase云存储
5. **数据存储**: 将解析后的数据保存到CloudBase数据库

## 数据存储

- **云存储路径**: `dmarc-reports/YYYY/MM/filename`
- **数据库集合**: `dmarc_reports`
- **数据结构**: 包含报告元数据、策略信息、记录详情等字段

## 注意事项

1. 所有敏感配置已硬编码，无需额外环境变量配置
2. 确保CloudBase空间有足够的存储和数据库配额
3. 建议定期清理旧的附件文件以节省存储空间
4. 可通过CloudBase控制台查看和管理数据