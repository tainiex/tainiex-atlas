# GitHub Secrets 配置模板

本文档说明如何配置 `ENV_WEB_PRODUCTION` 和 `ENV_API_PRODUCTION` 两个 GitHub Secrets。

## 配置步骤

1. 进入 GitHub 仓库页面
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 按照下面的模板创建两个 secrets

---

## ENV_WEB_PRODUCTION

**Name**: `ENV_WEB_PRODUCTION`

**Value** (复制下面的内容，填入实际值):

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_API_BASE_URL=https://your-api-url.run.app
VITE_MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_CLARITY_ID=your_clarity_id_here
```

### 说明

- `VITE_GOOGLE_CLIENT_ID`: Google OAuth 2.0 客户端 ID
  - 获取位置: [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)

- `VITE_API_BASE_URL`: 后端 API 的生产环境地址
  - 格式: `https://tainiex-atlas-xxx.run.app` (Cloud Run 的 URL)

- `VITE_MICROSOFT_CLIENT_ID`: Azure AD 应用程序客户端 ID
  - 获取位置: [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps)

- `VITE_SENTRY_DSN`: Sentry 项目的 DSN
  - 获取位置: Sentry → Project Settings → Client Keys (DSN)

- `VITE_CLARITY_ID`: Microsoft Clarity 项目 ID
  - 获取位置: [Microsoft Clarity Dashboard](https://clarity.microsoft.com/)

---

## ENV_API_PRODUCTION

**Name**: `ENV_API_PRODUCTION`

**Value** (复制下面的内容，填入实际值):

```env
NODE_ENV=production
LOG_LEVEL=info
API_PREFIX=api
VERTEX_LOCATION=us-central1
VERTEX_MODEL=gemini-3-pro-preview
DB_SSL=true
CORS_ORIGIN=https://your-frontend-url.web.app
VERTEX_PROJECT_ID=your-gcp-project-id
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-jwt-refresh-secret-here
DB_HOST=your-database-host
DB_PORT=5432
DB_USERNAME=your-db-username
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
AZURE_CLIENT_ID=your-azure-client-id
COOKIE_DOMAIN=.tainiex.com
GCS_BUCKET_NAME=tainiex-atlas
GCS_SERVICE_ACCOUNT=your-service-account-email@project.iam.gserviceaccount.com
MISTRAL_API_KEY=your-mistral-api-key
OPENWEATHER_API_KEY=your-openweather-api-key
TAVILY_API_KEY=your-tavily-api-key
ALPHAVANTAGE_API_KEY=your-alphavantage-api-key
OPENROUTER_API_KEY=your-openrouter-api-key
ZAI_API_KEY=your-zai-api-key
```

### 说明

#### 基础配置
- `NODE_ENV`: 运行环境 (固定为 `production`)
- `LOG_LEVEL`: 日志级别 (`debug`, `info`, `warn`, `error`)
- `API_PREFIX`: API 路由前缀 (默认 `api`)

#### Google Cloud / Vertex AI
- `VERTEX_LOCATION`: Vertex AI 区域 (如 `us-central1`)
- `VERTEX_MODEL`: Vertex AI 模型名称
- `VERTEX_PROJECT_ID`: GCP 项目 ID

#### 数据库配置
- `DB_HOST`: PostgreSQL 数据库地址
- `DB_PORT`: 数据库端口 (默认 `5432`)
- `DB_USERNAME`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `DB_NAME`: 数据库名称
- `DB_SSL`: 是否使用 SSL 连接 (`true` 或 `false`)

#### 认证配置
- `JWT_SECRET`: JWT token 签名密钥 (至少 32 字符的随机字符串)
- `JWT_REFRESH_SECRET`: JWT refresh token 签名密钥
- `GOOGLE_CLIENT_ID`: Google OAuth 客户端 ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth 客户端密钥
- `AZURE_CLIENT_ID`: Azure AD 应用程序客户端 ID
- `COOKIE_DOMAIN`: Cookie 作用域 (如 `.tainiex.com`)

#### CORS 配置
- `CORS_ORIGIN`: 允许的前端域名 (如 `https://your-app.web.app`)

#### Google Cloud Storage
- `GCS_BUCKET_NAME`: GCS 存储桶名称
- `GCS_SERVICE_ACCOUNT`: 服务账号邮箱

#### 第三方 API 密钥
- `MISTRAL_API_KEY`: Mistral AI API 密钥
- `OPENWEATHER_API_KEY`: OpenWeather API 密钥
- `TAVILY_API_KEY`: Tavily Search API 密钥
- `ALPHAVANTAGE_API_KEY`: Alpha Vantage API 密钥
- `OPENROUTER_API_KEY`: OpenRouter API 密钥
- `ZAI_API_KEY`: ZAI API 密钥

---

## 其他必需的 Secrets

除了上述两个环境变量 secrets，还需要配置：

### GCP_SA_KEY
**Name**: `GCP_SA_KEY`

**Value**: Google Cloud 服务账号的 JSON 密钥文件内容

**获取方法**:
1. 前往 [GCP Console → IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. 选择或创建服务账号
3. 点击 "Keys" → "Add Key" → "Create new key" → 选择 JSON
4. 下载的 JSON 文件内容即为此 secret 的值

**所需权限**:
- Cloud Run Admin
- Firebase Admin
- Storage Admin
- Service Account User

### GCP_PROJECT_ID
**Name**: `GCP_PROJECT_ID`

**Value**: 您的 GCP 项目 ID (如 `tainiex-prod-123456`)

**获取方法**: 在 [GCP Console](https://console.cloud.google.com/) 首页查看项目 ID

### CLOUD_RUN_GCP_SERVICE_ACCOUNT
**Name**: `CLOUD_RUN_GCP_SERVICE_ACCOUNT`

**Value**: Cloud Run 服务使用的服务账号邮箱

格式: `service-account-name@project-id.iam.gserviceaccount.com`

---

## 验证配置

配置完成后，推送代码到 `main` 分支，查看 GitHub Actions 的运行日志：

```bash
git add .
git commit -m "test: verify deployment configuration"
git push origin main
```

在 GitHub 仓库的 **Actions** 标签页可以看到部署进度。

---

## 安全注意事项

⚠️ **重要提示**:

1. **永远不要**将这些 secrets 提交到 git 仓库
2. **定期轮换**敏感密钥（JWT secrets、API keys、数据库密码）
3. **最小权限原则**: 服务账号只授予必要的权限
4. **环境隔离**: 生产环境和开发环境使用不同的密钥
5. **审计日志**: 定期检查 GCP 和 GitHub 的访问日志

---

## 故障排查

### 前端构建失败
- 检查 `ENV_WEB_PRODUCTION` 格式是否正确（每行一个变量）
- 确保所有 `VITE_` 前缀的变量都已配置
- 查看 GitHub Actions 日志中的具体错误信息

### 后端部署失败
- 检查 `ENV_API_PRODUCTION` 是否包含所有必需的变量
- 验证数据库连接信息是否正确
- 确保 GCP 服务账号有足够的权限

### OAuth 认证失败
- 确认 OAuth 重定向 URI 已在 Google/Azure 控制台中配置
- 检查 `CORS_ORIGIN` 是否与前端 URL 匹配
- 验证客户端 ID 和密钥是否正确

---

## 参考链接

- [GitHub Actions Secrets 文档](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Google Cloud IAM 文档](https://cloud.google.com/iam/docs)
- [Firebase Hosting 文档](https://firebase.google.com/docs/hosting)
- [Cloud Run 文档](https://cloud.google.com/run/docs)
