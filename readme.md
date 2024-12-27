# 飞书 AI-ChatGPT Gemini Claude 流式聊天 助手

一个基于 OpenAI GPT 模型的飞书机器人,流式打字机效果，支持智能对话、上下文记忆、流式响应等功能。飞书 ×（GPT + CLaude + Gemini）+ 打字机效果.

## 最终效果

![image](https://github.com/user-attachments/assets/d9fc4182-025f-4474-9fd8-c1187b30122d)


## 功能特点

- 🤖 基于 OpenAI 的 GPT-4/3.5 模型的智能对话,可自定义模型
- 🤖 支持自定义国内API中转站
- 🤖 支持自定义模型:Claude,Gemini,ChatGPT
- 💭 支持上下文记忆，实现连续对话
- ⚡ 流式响应，实时显示回复内容
- 📝 支持 Markdown 格式和代码高亮
- 📊 显示对话字数统计
- 🔄 支持清除对话记忆
- 💡 内置帮助指令

## 环境要求

- Node.js >= 16.14
- npm >= 8.0

## 快速开始

### 1. 配置飞书机器人

特别说明：配置第五步时候需要先把项目部署成功后启动才能配置第5步。
1. 访问[飞书开放平台](https://open.feishu.cn/app)
2. 创建一个新应用
3. 获取 App ID 和 App Secret
4. 在"权限管理"中开启以下权限：
   - `im:message`
   - `im:message.group_at_msg`
   - `im:message.p2p_msg`
5. 在"事件订阅"中配置长连接，需要先启动本项目后，才能保存成功。
![image](https://github.com/user-attachments/assets/2a021a97-96d1-40f8-b9c4-2abb45aef9bb)



### 2. 安装依赖
```bash
# 克隆项目
git clone [你的仓库地址]
cd feishu-chatgpt-bot

# 安装依赖
npm install
```

### 3. 环境配置
创建 .env 文件：
```bash
# 复制 .env.example 文件并重命名为 .env
cp .env.example .env
```

编辑env文件
```bash
# 飞书配置
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# OpenAI 配置
OPENAI_API_KEY=your_api_key

# GPT 模型配置
MODEL=gpt-4
MAX_TOKENS=4096
TEMPERATURE=0.8
```

###4. 启动项目
```bash
npm start
```

### 使用指南

### 基本对话
直接在飞书中 @ 机器人并输入问题即可开始对话。

### 特殊指令
/help 或 使用帮助: 显示帮助信息
/clear 或 清除记忆: 清除当前对话历史

### 注意事项
每次对话都会显示输入和输出的字数统计
支持连续对话，机器人会记住上下文
回复较长时会实时流式显示

# 致谢
OpenAI 提供的 GPT 模型支持
飞书开放平台的技术支持
所有贡献者的支持和帮助
