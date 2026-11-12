# 👨‍💻 贡献指南

### 🚀 开发前必读

- **提交问题**: 在[Issue 区](https://github.com/V2233/alemonjs-shared-store/issues)提出你的想法。
- **熟悉代码**: 本仓库采用monorepo架构，顶层主要目录结构如下：
  ```text
  ./
  ├── src/           # 核心源码
  ├── web/           # 前端源码
  ├── public/        # 公共静态资源
  ├── vars/          # 常用变量
  └── benchmark/     # 性能测试源码
  ```

### 安装依赖

```bash
yarn
```

### 启动开发服务器

后端
```bash
yarn dev
```

前端
```bash
yarn dev:web
```

### 构建产物

```bash
yarn build
```

```bash
yarn build:web
```


