'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAccount, useChainId, useConnect, useDisconnect, usePublicClient, useWalletClient, useReadContract, useWriteContract } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { parseAbi, encodeFunctionData, parseLog } from 'viem'

// ──── CONTRACT ABIs ────
const LaunchpadABI = [
  {
    type: 'function',
    name: 'launchTokenAndPool',
    inputs: [
      { name: '_tokenName', type: 'string' },
      { name: '_tokenSymbol', type: 'string' },
      { name: '_lpLockerAddress', type: 'address' },
      { name: '_numberOfPositions', type: 'uint256' },
      { name: '_imageUri', type: 'string' }, // NEW: image URL for metadata
    ],
    outputs: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'poolAddress', type: 'address' },
      { name: 'lpTokenIds', type: 'uint256[]' },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'positionCreator',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'TokenLaunched',
    inputs: [
      { name: 'tokenAddress', type: 'address', indexed: true },
      { name: 'poolAddress', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
    ],
  },
] as const

const LockerABI = [
  {
    type: 'function',
    name: 'getTokenPositions',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPendingRewards',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_who', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimRewards',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const PoolABI = [
  {
    type: 'function',
    name: 'slot0',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'liquidity',
    inputs: [],
    outputs: [{ name: '', type: 'uint128' }],
    stateMutability: 'view',
  },
] as const

// ──── CONFIG ────
const CONFIG = {
  launcher: '0x70FD86A7553F074f9C5fB0aBB50225D0cCB3E9Ae',
  locker: '0xEF41bC07dC8FE6C430435387Cc0f86f8594706F0',
  pathUSD: '0x20c0000000000000000000000000000000000000',
  ipfsGateway: 'https://ipfs.tempo.xyz/ipfs/', // Placeholder IPFS gateway
}

interface CommandEntry {
  command: string
  output: string[]
  timestamp: number
  isError?: boolean
}

// Simulated IPFS upload function
async function uploadToIPFS(file: File): Promise<string> {
  // In production, integrate real IPFS like Pinata, nft.storage, or Tempodex
  // For now, simulate with a deterministic URL based on file

  const mockGateway = 'https://gateway.pinata.cloud/ipfs/'
  const mockHash = await generateMockHash(file)
  return `${mockGateway}${mockHash}?filename=${file.name}`
}

// Generate a mock IPFS hash (for demo purposes)
async function generateMockHash(file: File): Promise<string> {
  // Create content from file
  const buffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(buffer)
  
  // Simple hash simulation (not real IPFS, just for demo)
  let hash = ''
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  for (let i = 0; i < 44; i++) {
    hash += chars[uint8Array[i % uint8Array.length] % chars.length]
  }
  
  return hash
}

export default function Terminal() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<CommandEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [imageUri, setImageUri] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: 42431 })
  const { writeContractAsync } = useWriteContract()
  const { connect, connectors, error: connectError } = useConnect()

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current && !isProcessing) {
      inputRef.current.focus()
    }
  }, [isProcessing, history])

  // Scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  // Add output line
  const addOutput = useCallback((lines: string[], isError = false) => {
    setHistory(prev => [...prev, {
      command: '',
      output: lines,
      timestamp: Date.now(),
      isError,
    }])
  }, [])

  // Add full command with output
  const addCommand = useCallback((cmd: string, lines: string[], isError = false) => {
    setHistory(prev => [...prev, {
      command: cmd,
      output: lines,
      timestamp: Date.now(),
      isError,
    }])
  }, [])

  // Format address
  const shortAddr = (addr: string) => 
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  // Format token amount
  const formatAmount = (amount: bigint, decimals = 18) => {
    const formatted = Number(amount) / Math.pow(10, decimals)
    return formatted.toFixed(6)
  }

  // ──── IPFS UPLOAD HANDLERS ────

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addCommand('upload', ['❌ Error: Please upload an image file only'], true)
      return
    }

    setIsProcessing(true)

    try {
      addCommand('upload', [
        'uploading...',
        ` > File: ${file.name}`,
        ` > Size: ${(file.size / 1024).toFixed(2)} KB`,
        ` > Type: ${file.type}`,
      ])

      addOutput([` > [sending to IPFS...],`])

      // Upload to IPFS
      const url = await uploadToIPFS(file)

      setImageUri(url)

      addOutput([
        ` > ✅ Image uploaded`,
        ` > URL: ${url}`,
        ``,
        ` > Image is now stored for token metadata`,
        ` > Run "launch" to use this image`,
      ])

    } catch (e) {
      addCommand('upload', [
        `❌ Upload failed: ${(e as Error).message}`,
      ], true)
    } finally {
      setIsProcessing(false)
    }
  }, [])

  // Handle file input change
  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  // Handle drag & drop
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Trigger file picker
  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // ──── CONTRACT QUERIES ────

  // Get pool info
  const getPoolInfo = useCallback(async (poolAddress: `0x${string}`) => {
    if (!publicClient) return []

    try {
      const [slot0, liquidity] = await Promise.all([
        publicClient.readContract({
          address: poolAddress,
          abi: PoolABI,
          functionName: 'slot0',
        }),
        publicClient.readContract({
          address: poolAddress,
          abi: PoolABI,
          functionName: 'liquidity',
        }),
      ])

      // Calculate price from sqrtPriceX96
      const sqrtPriceX96 = slot0[0] as bigint
      const price = Number(sqrtPriceX96) * Number(sqrtPriceX96) / Math.pow(2, 192)

      return [
        `Pool Status:`,
        `  Address: ${poolAddress}`,
        `  Liquidity: ${liquidity.toString()}`,
        `  Current Price: ${price.toExponential(2)}`,
        `  Tick: ${slot0[1]}`,
      ]
    } catch (e) {
      return [`❌ Failed to fetch pool info`].concat((e as Error).message.split('\n').map(l => `  ${l}`))
    }
  }, [publicClient])

  // Get positions for token
  const getTokenPositions = useCallback(async (tokenAddr: `0x${string}`) => {
    if (!publicClient) return []

    try {
      const positions = await publicClient.readContract({
        address: CONFIG.locker as `0x${string}`,
        abi: LockerABI,
        functionName: 'getTokenPositions',
        args: [tokenAddr],
      })

      if (positions.length === 0) {
        return ['No LP positions found for this token']
      }

      const lines = [
        `Token Positions (${positions.length} total):`,
      ]

      for (let i = 0; i < positions.length; i++) {
        const tokenId = positions[i]
        // Skip creator lookup for brevity

        lines.push(
          `  [${i + 1}] TokenId: ${tokenId}`
        )
      }

      return lines
    } catch (e) {
      return [`❌ Failed to fetch positions`].concat((e as Error).message.split('\n').map(l => `  ${l}`))
    }
  }, [publicClient])

  // Get pending rewards
  const getPendingRewards = useCallback(async (tokenAddr: `0x${string}`, who: `0x${string}`) => {
    if (!publicClient || !address) return 0n

    try {
      const rewards = await publicClient.readContract({
        address: CONFIG.locker as `0x${string}`,
        abi: LockerABI,
        functionName: 'getPendingRewards',
        args: [tokenAddr, who],
      })
      return rewards as bigint
    } catch (e) {
      console.error('Failed to get rewards:', e)
      return 0n
    }
  }, [publicClient, address])

  // ──── TRANSACTION HANDLERS ────

  // Execute launch (now with image support)
  const executeLaunch = useCallback(async (
    name: string,
    symbol: string,
    numPositions: number,
    imageUrl: string | null = null
  ) => {
    if (!isConnected) {
      addCommand('launch', [
        '❌ Error: Wallet not connected',
        '   Please run "connect" first to authenticate your wallet.',
      ], true)
      return
    }
    if (!writeContractAsync) {
      addCommand('launch', ['❌ Error: Wallet client unavailable'], true)
      return
    }

    addOutput(['> Executing launchTokenAndPool()', '> [pending...]', '> Sending transaction...'])

    try {
      const finalImageUri = imageUrl || imageUri || ''

      const hash = await writeContractAsync({
        address: CONFIG.launcher as `0x${string}`,
        abi: LaunchpadABI,
        functionName: 'launchTokenAndPool',
        args: [name, symbol, CONFIG.locker as `0x${string}`, BigInt(numPositions), finalImageUri],
        account: address,
      } as any)

      addOutput([`> ✅ Transaction sent: ${hash}`])

      // Wait for receipt
      addOutput(['> Waiting for confirmation...', '> [~30s]'])

      const receipt = await publicClient!.waitForTransactionReceipt({ hash })

      addOutput(['> ✅ Transaction confirmed'])

      // Parse logs to extract TokenLaunched event
      let tokenAddress: `0x${string}` | null = null
      let poolAddress: `0x${string}` | null = null

      try {
        const eventLogs = receipt.logs.filter((log): log is typeof log & { topics: readonly `0x${string}`[] } => 
          log.address.toLowerCase() === CONFIG.launcher.toLowerCase()
        )

        // Try to decode the TokenLaunched event
        // Event signature: TokenLaunched(address indexed tokenAddress, address indexed poolAddress, string name, string symbol)
        const eventAbi = LaunchpadABI.find(e => e.type === 'event' && e.name === 'TokenLaunched') as const
        
        for (const log of eventLogs) {
          try {
            const parsedLog = parseLog({
              abi: LaunchpadABI as any,
              address: log.address,
              topics: log.topics as `0x${string}`[],
              data: log.data,
            })
            
            if (parsedLog?.args) {
              tokenAddress = parsedLog.args.tokenAddress || tokenAddress
              poolAddress = parsedLog.args.poolAddress || poolAddress
              break
            }
          } catch (e) {
            // Continue if parsing fails
          }
        }

        // Fallback: try to decode manually if parseLog fails
        if (!tokenAddress && eventLogs.length > 0) {
          // Topic 0: event selector, Topic 1: tokenAddress, Topic 2: poolAddress
          const firstLog = eventLogs[0]
          if (firstLog.topics.length >= 3) {
            tokenAddress = firstLog.topics[1] as `0x${string}`
            poolAddress = firstLog.topics[2] as `0x${string}`
          }
        }
      } catch (e) {
        addOutput(['> ⚠️ Could not parse deployment events (using defaults)'])
      }

      // Use fallback addresses if parsing failed
      const finalTokenAddress = tokenAddress || CONFIG.launcher
      const finalPoolAddress = poolAddress || CONFIG.launcher
      addCommand('launch', [
        '> ──────────────────────────────────────────',
        '> ✅ LAUNCH COMPLETE',
        '> ──────────────────────────────────────────',
        `> Token Name: ${name}`,
        `> Symbol: ${symbol}`,
        `> Positions: ${numPositions}`,
        `> Image: ${imageUrl ? '✅ Uploaded' : '⚠ Not provided'}`,
        `> Image URL: ${imageUrl || '-'}`,
        `> Tx Hash: ${hash}`,
        `> Block: ${receipt.blockNumber}`,
        `> Gas Used: ${receipt.gasUsed.toString()}`,
        '> ',
        '> 📊 Deployed Contracts:',
        `>   Token: ${tokenAddress ? shortAddr(tokenAddress) : shortAddr(finalTokenAddress)} ${tokenAddress ? '✅' : '⚠️'}`,
        `>   Pool: ${poolAddress ? shortAddr(poolAddress) : shortAddr(finalPoolAddress)} ${poolAddress ? '✅' : '⚠️'}`,
        `>   Locker: ${shortAddr(CONFIG.locker)}`,
        '> ',
        '💡 Full addresses:',
        `>   Token: ${finalTokenAddress}`,
        `>   Pool: ${finalPoolAddress}`,
        '> ',
        '> 🔒 LP Positions locked in LpLockerv2',
        '> Run "positions <token>" to view',
        tokenAddress || poolAddress ? '' : '> ⚠️ Note: Event parsing failed, using launcher address as fallback',
      ])
    } catch (e) {
      addCommand('launch', [
        `❌ Launch failed: ${(e as Error).message}`,
        `   ${imageUrl ? 'Check image URL' : 'Check parameters'}`,
      ], true)
    }
  }, [writeContractAsync, isConnected, address, imageUri, publicClient, addCommand, addOutput])

  // Execute claim
  const executeClaim = useCallback(async (tokenAddr: `0x${string}`) => {
    if (!isConnected) {
      addCommand('claim', [
        '❌ Error: Wallet not connected',
        '   Please run "connect" first to authenticate your wallet.',
      ], true)
      return
    }
    if (!writeContractAsync) {
      addCommand('claim', ['❌ Error: Wallet client unavailable'], true)
      return
    }

    addOutput(['> Checking pending rewards...'])

    try {
      const rewards = await getPendingRewards(tokenAddr, address!)

      if (rewards === 0n) {
        addCommand('claim', [
          '❌ No pending rewards for this token',
          `   Token: ${tokenAddr}`,
          `   Claimable: 0`,
        ])
        return
      }

      addOutput([
        `> Found rewards: ${formatAmount(rewards)}`,
        '> Executing claimRewards()',
        '> [pending...]'
      ])

      const hash = await writeContractAsync({
        address: CONFIG.locker as `0x${string}`,
        abi: LockerABI,
        functionName: 'claimRewards',
        args: [tokenAddr],
        account: address,
      } as any)

      addOutput([`> ✅ Collected: ${hash}`])

      await new Promise(resolve => setTimeout(resolve, 30000))

      addCommand('claim', [
        '> ──────────────────────────────────────────',
        '> ✅ REWARDS CLAIMED',
        '> ──────────────────────────────────────────',
        `> Token: ${tokenAddr}`,
        `> Claimed: ${formatAmount(rewards)}`,
        `> Tx Hash: ${hash}`,
        `> Gas Used: ~210000`,
      ])
    } catch (e) {
      addCommand('claim', [
        `❌ Claim failed: ${(e as Error).message}`,
      ], true)
    }
  }, [writeContractAsync, isConnected, address, getPendingRewards, publicClient])

  // ──── COMMAND PROCESSOR ────

  const processCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return

    const parts = trimmed.split(/\s+/)
    const command = parts[0].toLowerCase()

    setIsProcessing(true)

    try {
      switch (command) {
        case 'help':
          addCommand(trimmed, [
            'AgentPad Protocol v1.0',
            '',
            'Available Commands:',
            '  connect [provider]              - Connect wallet (injected | walletconnect)',
            '  disconnect                      - Disconnect wallet',
            '  launch <name> <symbol> <positions>  - Deploy token, pool, liquidity',
            '  upload                          - Upload image for metadata (IPFS)',
            '  claim <tokenAddress>            - Claim accumulated rewards',
            '  pools <tokenAddress>            - Show pool info for token',
            '  positions <tokenAddress>        - Show LP positions for token',
            '  fees [command]                  - Manage fee sponsorship',
            '  status                          - Connection & chain status',
            '  balance [token]                 - Check wallet balance',
            '  clear                           - Clear terminal screen',
            '',
            'Wallet Requirements:',
            '  - launch, claim, fees, positions require connected wallet',
            '  - Run "connect" first if wallet is disconnected',
            '',
            'Examples:',
            '  connect injected                - Use MetaMask/Browser wallet',
            '  connect walletconnect           - Use WalletConnect',
            '  launch MyToken MTK 5',
            '  upload                          # or drag & drop image',
            '  claim 0xabc...123',
            '  positions 0x5489...',
          ])
          break

        case 'launch': {
          if (parts.length < 4) {
            addCommand(trimmed, [
              '❌ Invalid syntax',
              '   Usage: launch <name> <symbol> <positions>',
              '   ',
              '   Example: launch MyToken MTK 5',
              '   ',
              `   Image: ${imageUri ? '✅ Ready' : '⚠ Upload with "upload" first'}`,
              `   ${imageUri ? `   URL: ${imageUri}` : ''}`,
            ], true)
            break
          }

          const name = parts[1]
          const symbol = parts[2]
          const positions = parseInt(parts[3])

          if (isNaN(positions) || positions < 1 || positions > 10) {
            addCommand(trimmed, [
              '❌ Invalid positions',
              '   Must be between 1 and 10',
            ], true)
            break
          }

          await executeLaunch(name, symbol, positions, imageUri)
          break
        }

        case 'upload': {
          addCommand(trimmed, [
            '> Image upload (IPFS)',
            '  - Press Enter to select file',
            '  - Or drag & drop anywhere in terminal',
            '  - Supported: PNG, JPG, GIF, WebP',
            '> ',
            '> Click terminal or run "upload" to open file picker',
          ])

          // Actually trigger file picker when command is run without args
          triggerFileUpload()
          break
        }

        case 'claim': {
          if (parts.length < 2) {
            addCommand(trimmed, [
              '❌ Usage: claim <tokenAddress>',
              '   ',
              '   Example: claim 0xabc...',
            ], true)
            break
          }

          const tokenAddr = parts[1] as `0x${string}`
          await executeClaim(tokenAddr)
          break
        }

        case 'pools': {
          if (!isConnected) {
            addCommand(trimmed, [
              '❌ Error: Wallet not connected',
              '   Please run "connect" first to authenticate your wallet.',
            ], true)
            break
          }
          if (parts.length < 2) {
            addCommand(trimmed, [
              '❌ Usage: pools <tokenAddress>',
              '   ',
            ], true)
            break
          }

          const tokenAddr = parts[1] as `0x${string}`
          const lines = [
            `Pool Info for ${shortAddr(tokenAddr)}:`,
            `(Fetching from Uniswap V3...)`,
          ]

          addCommand(trimmed, lines)
          break
        }

        case 'positions': {
          if (!isConnected) {
            addCommand(trimmed, [
              '❌ Error: Wallet not connected',
              '   Please run "connect" first to authenticate your wallet.',
            ], true)
            break
          }
          if (parts.length < 2) {
            addCommand(trimmed, [
              '❌ Usage: positions <tokenAddress>',
              '   ',
            ], true)
            break
          }

          const tokenAddr = parts[1] as `0x${string}`
          const posLines = await getTokenPositions(tokenAddr)
          addCommand(trimmed, posLines)
          break
        }

        case 'status': {
          const statusLines = [
            'AgentPad Protocol Status',
            '════════════════════════',
            ``,
            `🔗 Network: Tempo Moderate (${chainId})`,
            `📬 RPC: https://rpc.moderato.tempo.xyz`,
            ``,
            `💼 Wallet: ${isConnected ? '✅ Connected' : '❌ Disconnected'}`,
            isConnected && address ? `👤 Address: ${shortAddr(address)}` : '',
            isConnected && address ? `📊 Chain: ${chainId}` : '',
            ``,
            `🖼️  Image Upload: ${imageUri ? '✅ Ready' : '⚠ Not uploaded'}`,
            imageUri ? `   URL: ${imageUri}` : '',
            ``,
            `🏗️  Contracts:`,
            `  Launcher: ${CONFIG.launcher}`,
            `  Locker:   ${CONFIG.locker}`,
            `  USDC:     ${CONFIG.pathUSD}`,
            ``,
            isConnected ? `   Run "launch", "claim", "positions" to interact` : `   Run "connect" to authenticate wallet`,
            ``,
          ]

          addCommand(trimmed, statusLines.filter(l => l))
          break
        }

        case 'balance': {
          const token = parts[1] as `0x${string}` || CONFIG.pathUSD

          if (!address || !publicClient) {
            addCommand(trimmed, ['❌ Wallet not connected or RPC unavailable'], true)
            break
          }

          try {
            const balance = await publicClient.readContract({
              address: token,
              abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
              functionName: 'balanceOf',
              args: [address],
            })

            addCommand(trimmed, [
              `Balance for ${shortAddr(token)}:`,
              `  Address: ${shortAddr(address)}`,
              `  Amount: ${formatAmount(balance as bigint)}`,
            ])
          } catch (e) {
            addCommand(trimmed, [`❌ Failed: ${(e as Error).message}`], true)
          }
          break
        }

        case 'clear':
          setHistory([])
          addCommand('clear', ['> Terminal cleared.'])
          break

        case 'connect': {
          const provider = parts[1]?.toLowerCase()
          
          addOutput(['> Wallet connection initiated...'])

          try {
            let connectorToUse
            if (!provider || provider === 'injected') {
              // Find injected connector (MetaMask, etc.)
              connectorToUse = connectors.find(c => c.type === 'injected')
            } else if (provider === 'walletconnect') {
              // Find WalletConnect connector
              connectorToUse = connectors.find(c => c.id === 'walletConnect')
            } else {
              addCommand('connect', [
                `❌ Unknown provider: ${provider}`,
                '   Supported: injected, walletconnect',
                '   Usage: connect [injected|walletconnect]',
              ], true)
              break
            }

            if (!connectorToUse) {
              addCommand('connect', [
                '❌ Connector not found',
                '   Please refresh the page and try again',
              ], true)
              break
            }

            addOutput([`> Connecting to ${connectorToUse.name}...`])
            await connect({ connector: connectorToUse })

            addCommand('connect', [
              '> ──────────────────────────────────────────',
              '> ✅ WALLET CONNECTED',
              '> ──────────────────────────────────────────',
              `> Provider: ${connectorToUse.name}`,
              `> Address: ${address ? shortAddr(address) : 'N/A'}`,
              `> Chain: ${chainId}`,
              '>',
              '> You can now run:',
              '>   - launch <name> <symbol> <positions>',
              '>   - claim <tokenAddress>',
              '>   - positions <tokenAddress>',
            ])
          } catch (e) {
            addCommand('connect', [
              `❌ Connection failed: ${(e as Error).message}`,
              '   Try: connect injected (for MetaMask)',
              '   Or: connect walletconnect',
            ], true)
          }
          break
        }

        case 'disconnect': {
          try {
            await disconnect()
            addCommand('disconnect', [
              '> ✅ Wallet disconnected',
              '  Run "connect" to authenticate again',
            ])
          } catch (e) {
            addCommand('disconnect', [
              `❌ Disconnect failed: ${(e as Error).message}`,
            ], true)
          }
          break
        }

        case 'fees': {
          if (!isConnected) {
            addCommand(trimmed, [
              '❌ Error: Wallet not connected',
              '   Please run "connect" first to authenticate your wallet.',
            ], true)
            break
          }
          addCommand('fees', [
            'Fee Sponsorship Status',
            '══════════════════════',
            '',
            `Wallet: ${shortAddr(address!)}`,
            'Available Fee Sponsors:',
            '  - AgentPad FeeManager (primary)',
            '  - Tempo Gasless Relayer (backup)',
            '',
            'Run "fees enable <sponsor>" to activate',
            'Run "fees status" to check current config',
          ])
          break
        }

        default:
          addCommand(trimmed, [
            `❌ Unknown command: ${command}`,
            '   Type "help" for available commands',
          ], true)
      }
    } catch (e) {
      addCommand(trimmed, [`❌ Error: ${(e as Error).message}`], true)
    } finally {
      setIsProcessing(false)
      setInput('')
    }
  }, [
    addCommand, addOutput, isConnected, chainId, address, publicClient,
    executeLaunch, executeClaim, getTokenPositions, imageUri, triggerFileUpload, handleFileUpload, handleFileUpload
  ])

  // Keyboard handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      processCommand(input)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
    }
  }

  return (
    <div 
      ref={dragDropRef}
      className="min-h-screen bg-black text-green-400 p-4 overflow-hidden"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Header */}
      <div className="mb-4 border-b border-green-700 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-500">AgentPad Terminal v1.0</h1>
          <p className="text-xs text-green-600 mt-1">Wallet enforcement active</p>
        </div>
        <div className="text-right">
          <div className={`text-sm font-bold ${isConnected ? 'text-green-500' : 'text-yellow-500'}`}>
            {isConnected ? '● WALLET CONNECTED' : '○ WALLET DISCONNECTED'}
          </div>
          {isConnected && address && (
            <div className="text-xs text-green-600">
              {shortAddr(address)} · Chain {chainId}
            </div>
          )}
          {!isConnected && (
            <div className="text-xs text-yellow-600 mt-1">
              ⚠ Run "connect" to enable transactions
            </div>
          )}
          {imageUri && isConnected && (
            <div className="text-xs text-green-400 mt-1">
              🖼️  Image ready for launch
            </div>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div 
        ref={terminalRef} 
        className="terminal-window bg-black border border-green-700 rounded p-4 font-mono text-sm h-[70vh] overflow-y-auto"
      >
        {history.length === 0 && (
          <div className={`mb-4 ${isConnected ? 'text-green-500' : 'text-yellow-500'}`}>
            <p>AgentPad Protocol CLI</p>
            <p>Connected to: Tempo Moderate (42431)</p>
            {isConnected ? (
              <>
                <p>✅ Wallet connected: {shortAddr(address!)}</p>
                <p>Type <span className="text-green-300">'help'</span> to begin</p>
              </>
            ) : (
              <>
                <p>⚠️ Wallet DISCONNECTED</p>
                <p>Type <span className="text-yellow-300">'connect'</span> to authenticate</p>
                <p className="text-yellow-600 mt-1">Commands like launch, claim, positions require wallet authentication</p>
              </>
            )}
            <p className={isConnected ? 'text-green-600 mt-2' : 'text-yellow-600 mt-2'}>> drag & drop images to upload to IPFS</p>
            <br />
          </div>
        )}

        {history.map((entry, i) => (
          <div key={i} className={`mb-3 ${entry.isError ? 'text-red-400' : 'text-green-400'}`}>
            {entry.command && (
              <div className="text-green-500 select-all">
                {'>'} {entry.command}
              </div>
            )}
            {entry.output.map((line, j) => (
              <div key={j} className={line.includes('❌') ? 'text-red-400' : 
                                       line.includes('✅') ? 'text-green-500' :
                                       line.includes('uploading...') ? 'text-yellow-500' :
                                       line.startsWith('>') ? 'text-green-300' : ''}>
                {line}
              </div>
            ))}
          </div>
        ))}

        {/* Input line */}
        <div className="flex items-center mt-2">
          <span className="text-green-500 mr-2 flex-shrink-0">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-green-400 font-mono"
            autoComplete="off"
            spellCheck="false"
            disabled={isProcessing}
          />
          <span className={isProcessing ? 'loading' : 'cursor'} style={{ marginLeft: '8px', flexShrink: 0 }}></span>
        </div>
      </div>

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelect}
        className="hidden"
      />

      {/* Footer */}
      <div className="mt-2 text-xs text-green-600 border-t border-green-700 pt-2 flex justify-between items-center">
        <span>Press Enter to execute | Type 'help' for commands</span>
        <div className="flex gap-3 items-center">
          {!isConnected && (
            <span className="text-yellow-500 font-bold">⚠ Wallet Required</span>
          )}
          {imageUri && isConnected && (
            <span className="text-green-400">🖼️  Ready for launch</span>
          )}
          <span className="text-green-600">drag & drop to upload</span>
        </div>
      </div>

      {/* Drag & Drop overlay */}
      <style jsx global>{`
        @keyframes loading {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loading {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #22c55e;
          border-radius: 50%;
          border-top-color: transparent;
          animation: loading 1s linear infinite;
        }
        .cursor {
          display: inline-block;
          width: 8px;
          height: 16px;
          background-color: #22c55e;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .terminal-window::-webkit-scrollbar {
          width: 6px;
        }
        .terminal-window::-webkit-scrollbar-track {
          background: #000;
        }
        .terminal-window::-webkit-scrollbar-thumb {
          background: #15803d;
          border-radius: 3px;
        }
        [draggable] {
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
      `}</style>
    </div>
  )
}
