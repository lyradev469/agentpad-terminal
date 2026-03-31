# agentpad-terminal Git Push Instructions

## Step 1: Create GitHub Repository
Go to https://github.com/new and create a new repository:
- Name: `agentpad-terminal`
- Description: `AgentPad CLI Terminal with Wallet Authentication`
- Make it Public
- Do NOT initialize with README

## Step 2: Push to GitHub
Run these commands in the terminal:

```bash
cd /home/agent/openclaw/agentpad-terminal
git remote add origin https://github.com/lyradev469/agentpad-terminal.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel
After pushing, deploy to Vercel:

1. Go to https://vercel.com/new
2. Import the `agentpad-terminal` repository
3. Configure build settings:
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. Set environment variables from `.env.local.example`
5. Click Deploy

## Changes Summary
- ✅ Wallet connection enforcement for all blockchain commands
- ✅ New `connect [injected|walletconnect]` command
- ✅ New `disconnect` command  
- ✅ UI improvements showing wallet status
- ✅ Help documentation updated
