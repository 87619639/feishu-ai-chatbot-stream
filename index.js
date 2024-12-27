const Lark = require('@larksuiteoapi/node-sdk');
const OpenAI = require('openai');
require('dotenv').config();

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

// 基础配置
const baseConfig = {
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET
};

// 初始化飞书客户端
const client = new Lark.Client(baseConfig);

// 初始化 WebSocket 客户端
const wsClient = new Lark.WSClient({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
  loggerLevel: Lark.LoggerLevel.info
});

// 在文件顶部添加一个标志来追踪消息处理状态
const messageProcessing = new Map();

// 在文件顶部添加
const processedMessages = new Set();

// 添加清理函数
function cleanProcessedMessages() {
  const oneHourAgo = Date.now() - 3600000; // 1小时前
  processedMessages.clear();
}

// 每小时清理一次
setInterval(cleanProcessedMessages, 3600000);

// 添加在文件顶部的常量定义部分
const MAX_HISTORY_LENGTH = 100000; // 最大历史记录长度（100000字符）
const MAX_MESSAGES_PER_USER = 20;  // 每个用户保留的最大消息数量
const SYSTEM_PROMPT = "你是一个智能助手，请基于上下文历史记录为用户提供帮助。"; // 系统提示语

// 用户会话历史记录存储
const userSessions = new Map();

// 在文件顶部添加常量
const CLEAR_COMMANDS = ['清除记忆', '/clear'];
const HELP_COMMANDS = ['/help', '使用帮助'];

// 帮助信息内容
const HELP_MESSAGE = `**🤖 AI 助手使用指南**

**基本功能**
1. 直接输入问题即可开始对话
2. AI 会记住对话上下文，可以连续对话
3. 支持代码高亮显示和 Markdown 格式

**特殊指令**
- \`/clear\` 或输入 \`清除记忆\`: 清除当前对话历史
- \`/help\` 或输入 \`使用帮助\`: 显示此帮助信息

**注意事项**
- 每次对话都会显示输入和输出的字数统计
- 使用 GPT-4 模型，支持更强大的对话能力
- 如果回复较长，会分段显示

如需了解更多功能，请继续探索或咨询管理员。`;

// 会话管理类
class SessionManager {
  constructor(userId) {
    this.userId = userId;
    this.messages = [];
    this.totalLength = 0;
  }

  // 添加消息
  addMessage(role, content) {
    const message = { role, content };
    this.messages.push(message);
    this.totalLength += content.length;

    // 如果超过最大长度，移除最早的消息
    while (this.totalLength > MAX_HISTORY_LENGTH || this.messages.length > MAX_MESSAGES_PER_USER) {
      const removed = this.messages.shift();
      if (removed.role !== 'system') { // 保留系统提示
        this.totalLength -= removed.content.length;
      }
    }
  }

  // 获取完整对话历史
  getMessages() {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      ...this.messages
    ];
  }

  // 清除历史记录
  clearHistory() {
    this.messages = [];
    this.totalLength = 0;
  }
}

// 处理消息的函数
async function handleMessage(userInput, chatId) {
  try {
    if (!messageHistory.has(chatId)) {
      messageHistory.set(chatId, []);
    }
    const history = messageHistory.get(chatId);
    
    history.push({ role: 'user', content: userInput });
    console.log('Added user message to history:', userInput);

    const messageId = await sendInitialMessage(chatId);
    console.log('Sent initial message:', messageId);

    try {
      const completion = await openai.chat.completions.create({
        messages: history,
        model: process.env.MODEL || 'gpt-3.5-turbo',
        stream: true,
        temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
        max_tokens: parseInt(process.env.MAX_TOKENS) || 2000
      });

      let responseContent = '';
      
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          responseContent += content;
          if (content.includes('\n') || responseContent.length % 20 === 0) {
            await updateMessage(chatId, messageId, responseContent, userInput.length, false);
          }
        }
      }

      await updateMessage(chatId, messageId, responseContent, userInput.length, true);
      history.push({ role: 'assistant', content: responseContent });
      
      console.log('============= Message Completed =============');
      console.log('Chat ID:', chatId);
      console.log('Message ID:', messageId);
      console.log('Input Length:', userInput.length);
      console.log('Output Length:', responseContent.length);
      console.log('Final Response:', responseContent);
      console.log('==========================================');
      
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      await sendErrorMessage(chatId);
    }
  } catch (error) {
    console.error('Error in handleMessage:', error);
    await sendErrorMessage(chatId);
  }
}

// 发送初始消息
async function sendInitialMessage(chatId) {
  const resp = await client.im.message.create({
    params: {
      receive_id_type: 'chat_id',
    },
    data: {
      receive_id: chatId,
      content: JSON.stringify({
        "config": {
          "wide_screen_mode": true
        },
        "elements": [
          {
            "tag": "markdown",
            "content": "思考中..."
          }
        ]
      }),
      msg_type: 'interactive'
    }
  });
  return resp.data.message_id;
}

// 更新消息
async function updateMessage(chatId, messageId, content, inputLength, isCompleted = false) {
  try {
    // 根据是否完成选择不同的 emoji 和文字
    const statusMessage = isCompleted 
      ? "✅ 如需更多帮助，请继续提问。" 
      : "⏳ 回复中，请等待...";
    
    await client.im.message.patch({
      path: {
        message_id: messageId
      },
      data: {
        content: JSON.stringify({
          "config": {
            "wide_screen_mode": true
          },
          "header": {
            "template": "blue",
            "title": {
              "content": "AI 助手回复",
              "tag": "plain_text"
            }
          },
          "elements": [
            {
              "tag": "markdown",
              "content": content
            },
            {
              "tag": "markdown",
              "content": `\n\n${statusMessage}  统计字数：输入(${inputLength}) 输出(${content.length})`
            }
          ]
        }),
        msg_type: "interactive"
      }
    });
  } catch (error) {
    console.error('Update message error:', error);
  }
}

// 发送错误消息
async function sendErrorMessage(chatId) {
  await client.im.message.create({
    params: {
      receive_id_type: 'chat_id',
    },
    data: {
      receive_id: chatId,
      content: JSON.stringify({
        "config": {
          "wide_screen_mode": true
        },
        "header": {
          "template": "red",
          "title": {
            "content": "错误提示",
            "tag": "plain_text"
          }
        },
        "elements": [
          {
            "tag": "markdown",
            "content": "❌ **抱歉，处理您的请求时出现错误**\n\n请稍后重试或联系管理员。"
          }
        ]
      }),
      msg_type: 'interactive'
    }
  });
}

// 优化启动逻辑
let isStarted = false;

function startBot() {
  if (isStarted) {
    return;
  }
  
  isStarted = true;
  console.log('Bot is starting...');
  
  wsClient.start({
    eventDispatcher: new Lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data) => {
        try {
          const {
            message: { chat_id, content, message_type, message_id, mentions }
          } = data;

          console.log('============= Received message =============');
          console.log('chat_id:', chat_id);
          console.log('message_id:', message_id);
          console.log('message_type:', message_type);
          console.log('content:', content);
          console.log('mentions:', mentions);
          console.log('==========================================');

          // 1. 立即返回成功响应给飞书，避免重发
          const response = { code: 0, msg: "success" };
          
          // 2. 检查是否是文本消息且是否 @ 了机器人
          if (message_type === 'text' && mentions && mentions.length > 0) {
            // 检查是否 @ 了本机器人
            const isBotMentioned = mentions.some(mention => 
              mention.name === '你的机器人名称' || 
              mention.id === '你的机器人 ID'
            );

            if (isBotMentioned) {
              // 移除消息中的 @ 部分，只保留实际内容
              const parsedContent = JSON.parse(content);
              let userInput = parsedContent.text.replace(/@[^@]+/g, '').trim();
              
              // 如果消息不为空，则处理
              if (userInput) {
                handleMessageAsync(chat_id, JSON.stringify({ text: userInput }), message_id);
              }
            }
          }
          
          return response;
        } catch (error) {
          console.error('Error in message handler:', error);
          return { code: -1, msg: "failed" };
        }
      }
    })
  });
}

// 将消息处理逻辑移到异步函数中
async function handleMessageAsync(chatId, content, messageId) {
  try {
    if (processedMessages.has(messageId)) {
      console.log(`Message ${messageId} already processed, skipping...`);
      return;
    }
    processedMessages.add(messageId);

    const userInput = JSON.parse(content).text.trim();
    console.log('User input:', userInput);

    // 检查是否是帮助指令
    if (HELP_COMMANDS.includes(userInput)) {
      console.log('Sending help message');
      const helpMessageId = await sendInitialMessage(chatId);
      await updateMessage(chatId, helpMessageId, HELP_MESSAGE, userInput.length, true);
      return;
    }

    // 检查是否是清除记忆指令
    if (CLEAR_COMMANDS.includes(userInput)) {
      console.log('Clearing memory for chat:', chatId);
      await clearMemory(chatId);
      return;
    }

    await handleMessage(userInput, chatId);
    
  } catch (error) {
    console.error('Error in handleMessageAsync:', error);
    await sendErrorMessage(chatId);
  }
}

// 添加清除记忆的函数
async function clearMemory(chatId) {
  try {
    // 清除该聊天的历史记录
    if (messageHistory.has(chatId)) {
      messageHistory.delete(chatId);
    }

    // 发送确认消息
    await client.im.message.create({
      params: {
        receive_id_type: 'chat_id',
      },
      data: {
        receive_id: chatId,
        content: JSON.stringify({
          "config": {
            "wide_screen_mode": true
          },
          "header": {
            "template": "green",
            "title": {
              "content": "记忆已清除",
              "tag": "plain_text"
            }
          },
          "elements": [
            {
              "tag": "markdown",
              "content": "✨ **聊天记忆已经清除**\n\n您可以开始新的对话了。"
            }
          ]
        }),
        msg_type: 'interactive'
      }
    });

    console.log(`Cleared memory for chat: ${chatId}`);
  } catch (error) {
    console.error('Error clearing memory:', error);
    await sendErrorMessage(chatId);
  }
}

// 如果你使用了消息历史记录存储，确保在文件顶部添加
const messageHistory = new Map();

// 启动机器人
startBot();

console.log('Bot is running with WebSocket connection...');

// 添加定期清理机制
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000; // 1小时前
  for (const [chatId, session] of userSessions.entries()) {
    if (session.lastActivity < oneHourAgo) {
      userSessions.delete(chatId);
    }
  }
}, 3600000); // 每小时检查一次 