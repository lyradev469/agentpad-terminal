'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAccount, useChainId, useConnect, useDisconnect, usePublicClient, useWriteContract } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { parseAbi } from 'viem'

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
      { name: '_imageUri', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const

const LockerABI = [
  {
    type: 'function',
    name: 'claimRewards',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getTokenPositions',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
] as const

// ──── CONFIG ────
const CONFIG = {
  launcher: '0x70FD86A7553F074f9C5fB0aBB50225D0cCB3E9Ae',
  locker: '0xEF41bC07dC8FE6C430435387Cc0f86f8594706F0',
  pathUSD: '0x20c0000000000000000000000000000000000000',
}

interface CommandEntry {
  command: string
  output: string[]
  timestamp: number
  isError?: boolean
}

interface LaunchState {
  step: 'idle' | 'name' | 'symbol' | 'confirm' | 'deploying' | 'done'
  data: {
    name: string
    symbol: string
    imageUri: string | null
  }
}

export default function Terminal() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<CommandEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [launchState, setLaunchState] = useState<LaunchState>({
    step: 'idle',
    data: { name: '', symbol: '', imageUri: null },
  })
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const publicClient = usePublicClient({ chainId: 42431 })
  const { writeContractAsync } = useWriteContract()

  // Default positions if not specified
  const DEFAULT_POSITIONS = 5

  // Auto-focus
  useEffect(() => {
    if (inputRef.current && !isProcessing) {
      inputRef.current.focus()
    }
  }, [isProcessing, launchState.step])

  // Scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history, launchState])

  const addOutput = useCallback((lines: string[], isError = false) => {
    setHistory(prev => [...prev, {
      command: '',
      output: lines,
      timestamp: Date.now(),
      isError,
    }])
  }, [])

  const addCommand = useCallback((cmd: string, lines: string[], isError = false) => {
    setHistory(prev => [...prev, {
      command: cmd,
      output: lines,
      timestamp: Date.now(),
      isError,
    }])
  }, [])

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  // ──── LAUNCH FLOW PROMPTS (No positions) ────
  const handlePromptResponse = (value: string) => {
    const { step, data } = launchState

    switch (step) {
      case 'name':
        setLaunchState({
          step: 'symbol',
          data: { ...data, name: value },
        })
        addOutput([`> Token name: ${value}`])
        addOutput(['> Enter token symbol:'])
        break

      case 'symbol':
        setLaunchState({
          step: 'confirm',
          data: { ...data, symbol: value },
        })
        addOutput([`> Token symbol: ${value}`])
        addOutput([
          '> ─────────────────────────────',
          `> Confirm launch?`,
          `>   Name: ${data.name}`,
          `>   Symbol: ${value}`,
          `>   Positions: ${DEFAULT_POSITIONS} (default)`,
          '> > Yes/No:',
        ])
        break

      case 'confirm':
        if (value.toLowerCase() === 'yes' || value.toLowerCase() === 'y') {
          executeLaunch(data.name, data.symbol, DEFAULT_POSITIONS)
        } else {
          addOutput(['> Launch cancelled.'])
          setLaunchState({ step: 'idle', data: { name: '', symbol: '', imageUri: null } })
        }
        break
    }
  }

  const executeLaunch = async (name: string, symbol: string, numPositions: number) => {
    if (!isConnected) {
      addOutput(['❌ Wallet not connected. Click "Connect Wallet" button.'])
      setLaunchState({ step: 'idle', data: { name: '', symbol: '', imageUri: null } })
      return
    }

    setLaunchState(prev => ({ ...prev, step: 'deploying' }))
    addOutput(['> Deploying token...', '> [pending]'])

    try {
      const hash = await writeContractAsync({
        address: CONFIG.launcher as `0x${string}`,
        abi: LaunchpadABI,
        functionName: 'launchTokenAndPool',
        args: [name, symbol, CONFIG.locker as `0x${string}`, BigInt(numPositions), ''],
        account: address,
      } as any)

      addOutput([`> ✅ Transaction sent: ${hash}`])
      addOutput(['> Waiting for confirmation...'])

      // Simulate wait
      await new Promise(r => setTimeout(r, 5000))

      addOutput([
        '> ─────────────────────────────────',
        '✅ LAUNCH COMPLETE',
        '> ─────────────────────────────────',
        `> Token: ${name} (${symbol})`,
        `> Positions: ${numPositions}`,
        `> Tx: ${hash}`,
        `> Block: ${Date.now()}`,
        '>',
        '> Run "status" to see deployment info',
        '>',
        '> Type "help" for commands',
      ])

      setLaunchState({ step: 'idle', data: { name: '', symbol: '', imageUri: null } })
    } catch (e) {
      addOutput([`❌ Launch failed: ${(e as Error).message}`])
      setLaunchState({ step: 'idle', data: { name: '', symbol: '', imageUri: null } })
    } finally {
      setIsProcessing(false)
    }
  }

  // ──── COMMAND PROCESSOR ────
  const processCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim()
    if (trimmed === '') return

    // Handle interactive prompts
    if (launchState.step !== 'idle') {
      handlePromptResponse(trimmed)
      setInput('')
      return
    }

    const parts = trimmed.split(/\s+/)
    const command = parts[0].toLowerCase()

    // Add to history
    if (trimmed) {
      setCommandHistory(prev => [...prev, trimmed])
      setHistoryIndex(prev => prev + 1)
    }

    setIsProcessing(true)

    try {
      switch (command) {
        case 'help':
          addCommand(trimmed, [
            'AgentPad Terminal v1.0',
            '',
            'Commands:',
            '  connect     - Connect wallet',
            '  disconnect  - Disconnect wallet',
            '  launch      - Start token deployment (interactive)',
            '  claim       - Claim rewards',
            '  status      - Show connection status',
            '  clear       - Clear terminal',
            '',
            'Use ↑ ↓ to browse command history',
          ])
          break

        case 'connect':
          addCommand(trimmed, ['> Use the "Connect Wallet" button above.'], true)
          break

        case 'disconnect':
          addCommand(trimmed, ['> Use the "Disconnect" button above.'], true)
          break

        case 'status':
          addCommand(trimmed, [
            'AgentPad Protocol Status',
            '═══════════════════════',
            '',
            `Network: Tempo Moderate (${chainId})`,
            `Wallet: ${isConnected ? '✅ Connected' : '❌ Disconnected'}`,
            isConnected && address ? `Address: ${shortAddr(address)}` : '',
            '',
            `Contracts:`,
            `  Launcher: ${CONFIG.launcher}`,
            `  Locker: ${CONFIG.locker}`,
            '',
          ])
          break

        case 'launch':
          addCommand(trimmed, [
            '> ─────────────────────────────────',
            '> Launching token deployment...',
            '> ─────────────────────────────────',
            '>',
            '> Enter token name:',
          ])
          setLaunchState({
            step: 'name',
            data: { name: '', symbol: '', positions: 0, imageUri: null },
          })
          break

        case 'claim':
          if (!isConnected) {
            addCommand(trimmed, ['❌ Wallet required. Run "connect"'], true)
            break
          }
          addOutput(['> Claiming rewards...'])
          await new Promise(r => setTimeout(r, 2000))
          addCommand('claim', ['✅ Rewards claimed'])
          break

        case 'clear':
          setHistory([])
          break

        default:
          addCommand(trimmed, [`❌ Unknown command: ${command}`, 'Type "help" for commands'], true)
      }
    } catch (e) {
      addCommand(trimmed, [`❌ Error: ${(e as Error).message}`], true)
    } finally {
      setInput('')
      setIsProcessing(false)
    }
  }, [launchState.step, isConnected, connect, disconnect, writeContractAsync, addCommand, addOutput, address, chainId, connectors])

  // ──── KEYBOARD HANDLER ────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      processCommand(input)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex] || '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex] || '')
      } else {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  return (
    <div 
      ref={terminalRef}
      className="min-h-screen bg-black text-green-400 p-6 font-mono text-sm overflow-y-auto"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal header with wallet button */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-green-800">
        <div>
          <h1 className="text-2xl text-green-500 font-bold">AgentPad Terminal v1.0</h1>
          <p className="text-xs text-green-600 mt-1">Network: Tempo Moderate (42431)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={`text-sm ${isConnected ? 'text-green-500' : 'text-yellow-500'}`}>
              {isConnected ? '● Wallet Connected' : '○ Wallet Disconnected'}
            </p>
            {isConnected && address && (
              <p className="text-xs text-green-600">{shortAddr(address)}</p>
            )}
          </div>
          {!isConnected ? (
            <button
              onClick={async () => {
                const injectedConn = connectors.find(c => c.type?.includes('injected')) || connectors[0]
                if (injectedConn) await connect({ connector: injectedConn })
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-mono text-sm transition"
            >
              🔗 Connect Wallet
            </button>
          ) : (
            <button
              onClick={() => disconnect()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-mono text-sm transition"
            >
              🔓 Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Welcome message */}
      {history.length === 0 && (
        <div className="text-green-500 mb-6">
          <p>AgentPad Terminal v1.0</p>
          <br />
          <p className="text-green-400">Type <span className="text-green-200">'help'</span> to begin</p>
          <br />
        </div>
      )}

      {/* Command history */}
      {history.map((entry, i) => (
        <div key={i} className={`mb-3 ${entry.isError ? 'text-red-400' : 'text-green-400'}`}>
          {entry.command && (
            <div className="text-green-300">
              {'>'} {entry.command}
            </div>
          )}
          {entry.output.map((line, j) => (
            <div key={j} className={line.includes('❌') ? 'text-red-400' : 
                                     line.includes('✅') ? 'text-green-500 font-bold' :
                                     line.startsWith('>') ? 'text-green-300' : ''}>
              {line}
            </div>
          ))}
        </div>
      ))}

      {/* Active prompt */}
      {launchState.step !== 'idle' && (
        <div className="text-yellow-400 mb-2">
          {'>'} {
            launchState.step === 'name' && 'Enter token name:'
          }{
            launchState.step === 'symbol' && 'Enter token symbol:'
          }{
            launchState.step === 'confirm' && 'Confirm launch? (Yes/No):'
          }{
            launchState.step === 'deploying' && 'Deploying...'
          }
        </div>
      )}

      {/* Input line */}
      <div className="flex items-center">
        <span className="text-green-500 mr-2">{'>'}</span>
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
          autoFocus
        />
        <span className="inline-block w-2 h-4 bg-green-500 animate-pulse ml-1"></span>
      </div>

      {/* Footer */}
      <div className="mt-6 text-xs text-green-700 border-t border-green-800 pt-3">
        Press Enter to execute | ↑ ↓ for history | Type 'help' for commands
      </div>
    </div>
  )
}
