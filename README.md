# Tainiex Monorepo

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-336791?logo=postgresql)](https://www.postgresql.org/)

**Tainiex Monorepo** 是一个现代化的全栈应用程序架构，包含：
- **Atlas (Backend)**: 基于 NestJS 的企业级后端 API
- **Lens (Frontend)**: 基于 React + Vite 的前端应用
- **Shared Atlas**: 前后端共享的 TypeScript 类型定义库

## 🏗️ Monorepo 结构

```
tainiex-atlas/
├── apps/
│   ├── api/              # NestJS 后端 API
│   └── web/              # React 前端应用
├── packages/
│   ├── shared-atlas/     # 共享 TypeScript 类型
│   └── shared-atlas-rust/# Rust 共享库
└── package.json          # Monorepo 根配置
```

## 🎯 产品定位

Tainiex 是一个**现代化、企业级的 AI 原生应用平台**，无缝集成：
- **安全认证**: JWT + Google OAuth + 基于角色的访问控制
- **实时协作**: 多用户编辑（CRDT/Y.js）和在线状态系统
- **AI 智能**: 原生集成 Google Vertex AI (Gemini) 用于聊天和 RAG
- **笔记系统**: Notion 风格的块编辑器，支持实时协作
- **知识图谱**: 个性化知识图谱，捕获实体关系

## ✨ 核心特性

### Backend (Atlas)
- **长期记忆**: AI 通过向量 RAG 记住用户偏好和项目细节
- **知识图谱**: 运行在 PostgreSQL 上的个性化知识图谱
- **高性能**: 重型 AI/图处理转移到通用 Worker Pool（基于 Piscina）
- **实时协作**: 基于 Y.js CRDT 的多用户编辑，支持光标同步
- **安全存储**: 通过 Google Cloud Storage 支持多媒体

### Frontend (Lens)
- **现代 UI**: React 18 + TypeScript + Vite
- **富文本编辑**: Tiptap 编辑器，支持 Markdown、表格、代码块
- **实时协作**: Y.js 集成，多用户同步编辑
- **认证集成**: Google OAuth + Microsoft MSAL
- **可观测性**: Sentry 错误监控 + Microsoft Clarity 用户行为分析

## 🚀 快速开始

### 环境要求

- **Node.js**: v18 或更高
- **pnpm**: v10.28.0 或更高
- **PostgreSQL**: v12 或更高
- **Google Cloud Platform** 账号（需启用相关 API）

### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/tainiex/tainiex-atlas.git
cd tainiex-atlas

# 安装所有依赖（根、backend、web、shared-atlas）
pnpm install

# 构建共享包
pnpm build:shared
```

### 配置环境变量

```bash
# 配置后端环境变量
cp apps/api/.env.example apps/api/.env
# 编辑 apps/api/.env 填入你的配置

# 配置前端环境变量
cp apps/web/.env.example apps/web/.env
# 编辑 apps/web/.env 填入你的配置
```

### 开发模式

```bash
# 同时启动前端和后端开发服务器
pnpm dev

# 或分别启动
pnpm dev:api      # 后端 API 运行在 http://localhost:2020
pnpm dev:web      # 前端运行在 http://localhost:2000
```

### 构建生产版本

```bash
# 构建所有项目（shared-atlas + backend + web）
pnpm build

# 或分别构建
pnpm build:api
pnpm build:web
```

### 运行生产环境

```bash
# 启动后端生产服务器
pnpm start:prod
```

## 📦 可用脚本

### 根级命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 同时启动前后端开发服务器 |
| `pnpm build` | 构建所有项目 |
| `pnpm test` | 运行所有测试 |
| `pnpm lint` | 检查代码规范 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm validate` | 运行完整验证（typecheck + lint + test） |

### 单项目命令

| 命令 | 说明 |
|------|------|
| `pnpm build:api` | 仅构建后端 API |
| `pnpm build:web` | 仅构建前端 |
| `pnpm build:shared` | 仅构建共享包 |
| `pnpm dev:api` | 仅启动后端 API 开发服务器 |
| `pnpm dev:web` | 仅启动前端开发服务器 |
| `pnpm test:api` | 仅运行后端 API 测试 |
| `pnpm test:web` | 仅运行前端测试 |

## 🛠️ 技术栈

### Backend
- **框架**: NestJS 11.0
- **语言**: TypeScript 5.7
- **数据库**: PostgreSQL + TypeORM
- **认证**: JWT + Passport.js + Google OAuth 2.0
- **AI/ML**: Google Vertex AI (Gemini) / Mistral AI
- **协作**: Y.js (CRDT) + Socket.io
- **存储**: Google Cloud Storage
- **测试**: Jest
- **构建**: SWC

### Frontend
- **框架**: React 18.3
- **构建工具**: Vite 7.2
- **语言**: TypeScript 5.9
- **编辑器**: Tiptap 3.15 + Lowlight
- **协作**: Yjs 13.6 + Socket.io-client
- **认证**: @react-oauth/google + @azure/msal-react
- **状态管理**: XState 5.25
- **监控**: Sentry + Microsoft Clarity
- **测试**: Vitest

### Shared
- **类型共享**: @tainiex/shared-atlas (TypeScript)
- **验证**: Zod 4.3
- **包管理**: pnpm workspace

## 🔒 安全最佳实践

- 全局验证管道
- 速率限制
- 环境隔离配置
- JWT 令牌刷新机制
- CSP（内容安全策略）
- 文件上传大小限制

## 📚 项目文档

- [Agents 文档](./AGENTS.md) - AI Agent 系统说明
- [前端迁移指南](./FRONTEND_MIGRATION_GUIDE.md) - 前端事件类型迁移
- [测试文档](./apps/web/TESTS.md) - 测试指南
- [安全文档](./apps/web/SECURITY.md) - 安全策略

## 🤝 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 Apache License 2.0 许可证。详见 [LICENSE](LICENSE) 文件。

## 👥 作者

**zilianpn**

## 🌟 致谢

特别感谢所有为这个项目做出贡献的开发者和开源社区。
