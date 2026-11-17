import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

try {
  const claude = new Anthropic();
  const r = await claude.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    max_tokens: 20,
    messages: [{ role: 'user', content: 'Say hi in 3 words' }],
  });
  console.log('✅ Claude works:', r.content[0].text);
} catch (e) {
  console.log('❌ Claude problem:', e.message);
}

try {
  const openai = new OpenAI();
  await openai.models.list();
  console.log('✅ OpenAI (Whisper) works');
} catch (e) {
  console.log('❌ OpenAI problem:', e.message);
}