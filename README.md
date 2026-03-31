# AgentPad Terminal

CLI-style terminal interface for AgentPad token launchpad on Tempo blockchain.

## 🎯 Features

- **Terminal UI**: Black background, green text, blinking cursor
- **Command-based**: Interact via commands, not forms
- **Wallet Integration**: Connect MetaMask/WalletConnect
- **Launch Flow**: Step-by-step token launch wizard
- **Real-time Feedback**: Transaction status, loading animations
- **History**: Command history with arrow key navigation

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open terminal at http://localhost:3000
```

## 💻 Commands

### `help`
Show available commands

### `connect injected`
Connect MetaMask wallet

### `connect walletconnect`
Connect via WalletConnect

### `disconnect`
Disconnect wallet

### `status`
Show connection and chain status

### `launch`
Interactive token launch wizard

### `claim`
Claim accumulated rewards

### `history`
Show command history

### `clear`
Clear terminal screen

## 🎨 Usage Example

```
> help
> AgentPad v1.0 - CLI Token Launchpad
> 
> Available Commands:
>   help      - Show this help message
>   connect   - Connect wallet
>   launch    - Launch a new token
>   ...
>
> connect injected
> > Connecting to MetaMask...
> > ✅ Connected: 0x1234...5678
>
> launch
> > Enter token name: TestToken
> > Enter token symbol: TST
> > Number of LP positions: 5
> > Executing launchTokenAndPool()
> > [loading...]
> > ✅ Token deployed: 0x...
> > ✅ Pool created
> > ✅ Liquidity injected
```

## 🛠️ Tech Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **Wallet**: wagmi + viem
- **Blockchain**: Tempo Moderate (Chain 42431)

## 🔧 Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## 📁 Project Structure

```
agentpad-terminal/
├── app/
│   ├── page.tsx          # Main terminal component
│   ├── layout.tsx        # Root layout
│   ├── globals.css       # Global styles
│   └── providers.tsx     # Wagmi & Query providers
├── tailwind.config.js    # Tailwind configuration
├── postcss.config.js     # PostCSS configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies
```

## ⚡ Contract Integration

The terminal integrates with these contracts:

- **AgentPadLaunchpad**: `launchTokenAndPool()`
- **LpLockerv2**: `claimRewards()`
- **Token Contract**: Transfer functions

## 🌐 Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables

```env
NEXT_PUBLIC_RPC_URL=https://rpc.moderato.tempo.xyz
NEXT_PUBLIC_CHAIN_ID=42431
```

## 🎯 Design Principles

1. **No Buttons**: Pure keyboard interaction
2. **Terminal Immersion**: Everything feels like a CLI
3. **Real-time Feedback**: Loading states, success/error messages
4. **Minimal UI**: Only essential elements
5. **Developer Experience**: Fast, intuitive, powerful

## 📝 License

MIT

---

**AgentPad Terminal** | Built for Tempo Blockchain
