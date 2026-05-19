import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { getToken } from '../utils/auth'
import api from '../utils/api'

interface Player {
    playerId: string
    playerName: string
    role: string
    team: string
    squadStatus?: 'playingXI' | 'impact' | 'squad'
}

interface PreDraftEntry {
    squadPlayerId: string
    playerName: string
    team: string
    pickType: string
    rankOrder: number
}

interface Turn {
    pickNumber: number
    roundNumber: number
    roundType: string
    roundLabel: string
    picksEach: number
    pickInRound: number
    totalInRound: number
    userId: string
    timeLimit?: number
    isOnline?: boolean
}

const MAX_PER_TEAM: Record<string, number> = {
    batsman: 2,
    bowler: 1,
    allrounder: 1
}

interface Pick {
    userId: string
    squadPlayerId: string
    playerName: string
    team: string
    pickType: string
    pickNumber: number
    roundNumber: number
    isAutoPick: boolean
    isVoid: boolean
}

const ROUND_ICONS: Record<string, string> = {
    batsman: '🏏',
    bowler: '🎯',
    allrounder: '⚡'
}

const ROUND_COLORS: Record<string, string> = {
    batsman: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
    bowler: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
    allrounder: 'from-amber-500/20 to-amber-600/5 border-amber-500/30'
}

export default function LiveDraft() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const socketRef = useRef<Socket | null>(null)

    const [myUserId, setMyUserId] = useState('')
    const [started, setStarted] = useState(false)
    const [complete, setComplete] = useState(false)
    const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({})
    const [waitingMessage, setWaitingMessage] = useState('')

    const [currentTurn, setCurrentTurn] = useState<Turn | null>(null)
    const [timer, setTimer] = useState(60)
    const [maxTime, setMaxTime] = useState(60)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [lastPick, setLastPick] = useState<Pick | null>(null)

    const [picks, setPicks] = useState<Pick[]>([])
    const [pool, setPool] = useState<{
        batsmen: Player[]
        bowlers: Player[]
        allrounders: Player[]
    }>({ batsmen: [], bowlers: [], allrounders: [] })

    const [matchInfo, setMatchInfo] = useState<any>(null)
    const [preDraft, setPreDraft] = useState<{
        batsmen: PreDraftEntry[]
        bowlers: PreDraftEntry[]
        allrounders: PreDraftEntry[]
    }>({ batsmen: [], bowlers: [], allrounders: [] })

    // Fetch squad + pre-draft on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [squadRes, pdRes] = await Promise.all([
                    api.get(`/rooms/${roomId}/squad`),
                    api.get(`/rooms/${roomId}/predraft`)
                ])
                setMatchInfo(squadRes.data.match)
                setPool({
                    batsmen: squadRes.data.batsmen,
                    bowlers: squadRes.data.bowlers,
                    allrounders: squadRes.data.allrounders
                })
                setPreDraft({
                    batsmen: pdRes.data.batsmen,
                    bowlers: pdRes.data.bowlers,
                    allrounders: pdRes.data.allrounders
                })
            } catch (err) {
                console.error(err)
            }
        }
        fetchData()
    }, [roomId])

    // Connect socket
    useEffect(() => {
        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
            transports: ['websocket', 'polling'],
            withCredentials: true
        })
        socketRef.current = socket

        socket.on('connect', () => {
            const token = getToken()
            if (token) socket.emit('auth', token)
        })

        socket.on('auth:success', ({ userId }) => {
            setMyUserId(userId)
            socket.emit('draft:join', roomId)
        })

        socket.on('draft:waiting', ({ message }) => {
            setWaitingMessage(message)
        })

        socket.on('draft:online', (status: Record<string, boolean>) => {
            setOnlineStatus(status)
        })

        socket.on('draft:started', () => {
            setStarted(true)
            setWaitingMessage('')
        })

        socket.on('draft:turn', (turn: Turn) => {
            setCurrentTurn(turn)
            const t = turn.timeLimit || 30
            setTimer(t)
            setMaxTime(t)
        })

        socket.on('draft:pick', (pick: Pick) => {
            setPicks(prev => [...prev, pick])
            setLastPick(pick)
            setTimeout(() => setLastPick(null), 1500)
        })

        socket.on('draft:complete', () => {
            setComplete(true)
            setTimeout(() => {
                navigate(`/room/${roomId}/result`)
            }, 3000)
        })

        socket.on('draft:error', ({ error }) => {
            console.error('Draft error:', error)
        })

        return () => {
            socket.disconnect()
        }
    }, [roomId, navigate])

    // Countdown timer
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current)

        if (started && currentTurn && !complete) {
            timerRef.current = setInterval(() => {
                setTimer(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [currentTurn, started, complete])

    const pickedIds = new Set(picks.map(p => p.squadPlayerId))
    const isMyTurn = currentTurn?.userId === myUserId

    const currentRoundPlayers = useCallback((): Player[] => {
        if (!currentTurn) return []
        const typeMap: Record<string, keyof typeof pool> = {
            batsman: 'batsmen',
            bowler: 'bowlers',
            allrounder: 'allrounders'
        }
        return pool[typeMap[currentTurn.roundType]] || []
    }, [currentTurn, pool])

    // Team count for current user, grouped by pickType:team
    const myTeamCounts: Record<string, number> = {}
    picks.filter(p => p.userId === myUserId && !p.isVoid && p.team).forEach(p => {
        const key = `${p.pickType}:${p.team}`
        myTeamCounts[key] = (myTeamCounts[key] || 0) + 1
    })

    const isTeamFull = (team: string) => {
        if (!currentTurn) return false
        const limit = MAX_PER_TEAM[currentTurn.roundType] || 1
        const key = `${currentTurn.roundType}:${team}`
        return (myTeamCounts[key] || 0) >= limit
    }

    const handlePick = (player: Player) => {
        if (!isMyTurn || !socketRef.current || pickedIds.has(player.playerId)) return
        if (isTeamFull(player.team)) return
        socketRef.current.emit('draft:pick', {
            roomId,
            squadPlayerId: player.playerId,
            playerName: player.playerName,
            team: player.team
        })
    }

    const myPicks = picks.filter(p => p.userId === myUserId)
    const oppPicks = picks.filter(p => p.userId !== myUserId)
    const oppUserId = Object.keys(onlineStatus).find(id => id !== myUserId) || ''
    const myOnline = onlineStatus[myUserId] ?? true
    const oppOnline = onlineStatus[oppUserId] ?? false

    // Build a lookup for squad status by playerId
    const allPoolPlayers = [...pool.batsmen, ...pool.bowlers, ...pool.allrounders]
    const squadStatusMap: Record<string, string> = {}
    allPoolPlayers.forEach(p => { squadStatusMap[p.playerId] = p.squadStatus || 'squad' })

    // Current round's pre-draft priority list
    const currentRoundPreDraft = (() => {
        if (!currentTurn) return []
        const typeMap: Record<string, keyof typeof preDraft> = {
            batsman: 'batsmen',
            bowler: 'bowlers',
            allrounder: 'allrounders'
        }
        return preDraft[typeMap[currentTurn.roundType]] || []
    })()
    const timerPercent = maxTime > 0 ? (timer / maxTime) * 100 : 0
    const timerColor = timer <= 10 ? 'text-red-400' : timer <= 20 ? 'text-yellow-400' : 'text-green-400'
    const timerRingColor = timer <= 10 ? 'stroke-red-500' : timer <= 20 ? 'stroke-yellow-500' : 'stroke-green-500'

    // --- WAITING SCREEN ---
    if (!started) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
                <div className="text-center flex flex-col items-center gap-8 max-w-sm w-full">
                    {matchInfo && (
                        <div className="text-sm font-medium text-gray-400">
                            {matchInfo.teamHome} vs {matchInfo.teamAway}
                        </div>
                    )}
                    <div>
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-green-500/30 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full border-t-2 border-green-500 animate-spin" />
                        </div>
                        <h2 className="text-xl font-bold mb-1">Waiting for Draft</h2>
                        <p className="text-gray-500 text-sm">
                            {waitingMessage || 'Draft will start automatically before match time'}
                        </p>
                    </div>

                    {/* Draft Flow Timeline */}
                    <div className="w-full bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-left">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                            Draft Timeline
                        </h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3 items-start">
                                <div className="flex flex-col items-center">
                                    <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-[10px] text-green-400 font-bold shrink-0">1</div>
                                    <div className="w-px h-full bg-gray-700 mt-1" />
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-green-400">Toss → T-15 min</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5">Join after toss. Draft starts when both players are ready.</div>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
                                <div className="flex flex-col items-center">
                                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-[10px] text-yellow-400 font-bold shrink-0">2</div>
                                    <div className="w-px h-full bg-gray-700 mt-1" />
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-yellow-400">T-15 min → T-5 min</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5">Draft keeps going. Auto-pick covers you if your opponent goes offline.</div>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
                                <div className="flex flex-col items-center">
                                    <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-[10px] text-red-400 font-bold shrink-0">3</div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-red-400">T-5 min → Match Start</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5">Draft locks. Any unpicked slots are auto-filled from your pre-draft list.</div>
                                </div>
                            </div>
                        </div>
                        {matchInfo?.startTime && (
                            <div className="mt-3 text-[10px] text-gray-600 text-center">
                                T = Match start ({new Date(matchInfo.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })} IST)
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // --- COMPLETE SCREEN ---
    if (complete) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
                <div className="text-center flex flex-col items-center gap-6">
                    <div className="text-6xl animate-bounce">🏆</div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
                        Draft Complete!
                    </h2>
                    <p className="text-gray-400 text-sm">Your squad is locked in</p>
                    <div className="flex gap-6 mt-2">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-400">{myPicks.length}</div>
                            <div className="text-xs text-gray-500">Your picks</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-400">{oppPicks.length}</div>
                            <div className="text-xs text-gray-500">Opp picks</div>
                        </div>
                    </div>
                    <p className="text-gray-600 text-xs mt-4">Redirecting to results...</p>
                </div>
            </div>
        )
    }

    // --- DRAFT UI ---
    const available = currentRoundPlayers().filter(p => !pickedIds.has(p.playerId))
    const roundColor = ROUND_COLORS[currentTurn?.roundType || 'batsman'] || ROUND_COLORS.batsman
    const roundIcon = ROUND_ICONS[currentTurn?.roundType || 'batsman'] || '🏏'

    // Progress dots
    const totalPicks = 16
    const progressDots = Array.from({ length: totalPicks }, (_, i) => {
        const isPicked = i < picks.length
        const isCurrent = i === picks.length
        return { isPicked, isCurrent }
    })

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col">
            {/* Header */}
            <div className={`px-4 py-3 border-b border-gray-800 bg-gradient-to-r ${roundColor}`}>
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-base">{roundIcon}</span>
                            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                                Round {currentTurn?.roundNumber} · {currentTurn?.roundLabel}
                            </span>
                        </div>
                        <div className="font-bold text-sm">
                            Pick {currentTurn?.pickInRound} of {currentTurn?.totalInRound || 7}
                        </div>
                    </div>

                    {/* Timer ring */}
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" strokeWidth="3" className="stroke-gray-800" />
                            <circle
                                cx="32" cy="32" r="28" fill="none" strokeWidth="3"
                                className={`${timerRingColor} transition-all duration-1000`}
                                strokeDasharray={`${2 * Math.PI * 28}`}
                                strokeDashoffset={`${2 * Math.PI * 28 * (1 - timerPercent / 100)}`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className={`text-lg font-mono font-bold ${timerColor} z-10`}>
                            {timer}
                        </span>
                    </div>

                    <div className="flex-1 text-right">
                        <div className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold tracking-wide ${
                            isMyTurn
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                            {isMyTurn ? '🟢 YOUR PICK' : '🟡 OPPONENT'}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1 flex items-center justify-end gap-1.5">
                            Pick #{currentTurn?.pickNumber} of {totalPicks}
                            {currentTurn && !isMyTurn && (
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                    onlineStatus[currentTurn.userId] ? 'bg-green-500' : 'bg-red-500'
                                }`} title={onlineStatus[currentTurn.userId] ? 'Online' : 'Offline'} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-1 mt-3">
                    {progressDots.map((dot, i) => (
                        <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                dot.isPicked
                                    ? 'bg-green-500'
                                    : dot.isCurrent
                                        ? 'bg-white/50 animate-pulse'
                                        : 'bg-gray-700/50'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Pick notification banner */}
            {currentTurn && !isMyTurn && currentTurn.isOnline === false && (
                <div className="px-4 py-2 bg-orange-500/20 border-b border-orange-500/20 text-center">
                    <span className="text-xs text-orange-300">⚠️ Opponent is away — auto-picking for them</span>
                </div>
            )}

            {lastPick && (
                <div className="px-4 py-2 bg-indigo-600/20 border-b border-indigo-500/20 text-center animate-pulse">
                    <span className="text-xs text-indigo-300">
                        {lastPick.userId === myUserId ? 'You picked' : 'Opponent picked'}{' '}
                        <strong className="text-white">{lastPick.playerName}</strong>
                        {lastPick.isAutoPick && ' ⚡ (auto)'}
                    </span>
                </div>
            )}

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Main panel — available players */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-300">
                            Available {currentTurn?.roundLabel}
                        </h3>
                        <span className="text-xs bg-gray-800/80 px-2.5 py-1 rounded-full text-gray-400 font-medium">
                            {available.length} players
                        </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {available.map(player => {
                            const teamFull = isMyTurn && isTeamFull(player.team)
                            const canPick = isMyTurn && !teamFull
                            return (
                                <button
                                    key={player.playerId}
                                    onClick={() => handlePick(player)}
                                    disabled={!canPick}
                                    className={`relative text-left p-3 rounded-xl transition-all duration-200 ${
                                        canPick
                                            ? 'bg-gray-900/80 hover:bg-gray-800 hover:scale-[1.03] cursor-pointer border border-gray-700/50 hover:border-green-500/40 hover:shadow-lg hover:shadow-green-500/10'
                                            : teamFull
                                                ? 'bg-gray-900/30 cursor-not-allowed border border-red-900/30 opacity-40'
                                                : 'bg-gray-900/30 cursor-not-allowed border border-gray-800/40 opacity-50'
                                    }`}
                                >
                                    {teamFull && (
                                        <div className="absolute top-1.5 right-1.5 text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">
                                            Full
                                        </div>
                                    )}
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${
                                        canPick ? 'bg-gradient-to-br from-gray-700 to-gray-800 text-white' : 'bg-gray-800/50 text-gray-600'
                                    }`}>
                                        {player.playerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </div>
                                    <div className={`font-semibold text-[13px] leading-tight mb-0.5 ${canPick ? 'text-white' : 'text-gray-600'}`}>
                                        {player.playerName}
                                    </div>
                                    <div className="text-[11px] text-gray-500 leading-tight flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                                            player.squadStatus === 'playingXI' ? 'bg-green-500'
                                                : player.squadStatus === 'impact' ? 'bg-yellow-500'
                                                : 'bg-gray-600'
                                        }`} />
                                        {player.team}
                                    </div>
                                    <div className="text-[10px] text-gray-600 mt-1">
                                        {player.role}
                                        {player.squadStatus === 'playingXI' && (
                                            <span className="text-green-500 ml-1">XI</span>
                                        )}
                                        {player.squadStatus === 'impact' && (
                                            <span className="text-yellow-500 ml-1">IMP</span>
                                        )}
                                    </div>
                                    {canPick && (
                                        <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                                            <span className="text-green-400 text-xs font-bold">+</span>
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                    {available.length === 0 && (
                        <div className="text-center text-gray-600 py-16">
                            <div className="text-4xl mb-3">🎲</div>
                            <p className="text-sm">No more players in this category</p>
                        </div>
                    )}
                </div>

                {/* Sidebar — picks so far */}
                <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-800 overflow-y-auto bg-gray-900/20">
                    <div className="p-4">
                        {/* Your Squad */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${myOnline ? 'bg-green-500' : 'bg-gray-600'}`} />
                                    <h4 className="text-sm font-bold text-green-400 uppercase tracking-wider">
                                        You {myOnline ? '' : '(offline)'}
                                    </h4>
                                </div>
                                <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-bold">
                                    {myPicks.length}/7
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {myPicks.map((pick) => (
                                    <div
                                        key={pick.pickNumber}
                                        className="bg-green-500/5 border border-green-500/10 rounded-lg px-3 py-2.5 flex items-center gap-3"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-xs font-bold text-green-400 shrink-0">
                                            #{pick.pickNumber}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm text-white font-medium">{pick.playerName}</div>
                                            <div className="text-[11px] text-gray-500">{pick.team}</div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {pick.isAutoPick && <span className="text-yellow-400 text-sm" title="Auto-picked">⚡</span>}
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                                pick.pickType === 'batsman'
                                                    ? 'bg-blue-500/10 text-blue-400'
                                                    : pick.pickType === 'bowler'
                                                        ? 'bg-purple-500/10 text-purple-400'
                                                        : 'bg-amber-500/10 text-amber-400'
                                            }`}>
                                                {pick.pickType === 'batsman' ? 'BAT' : pick.pickType === 'bowler' ? 'BOWL' : 'AR'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {myPicks.length === 0 && (
                                    <div className="text-xs text-gray-600 text-center py-4 border border-dashed border-gray-800 rounded-lg">
                                        No picks yet
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Opponent */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${oppOnline ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                                    <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">
                                        Opponent {oppOnline ? '' : '(offline)'}
                                    </h4>
                                </div>
                                <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-bold">
                                    {oppPicks.length}/7
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {oppPicks.map((pick) => (
                                    <div
                                        key={pick.pickNumber}
                                        className="bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2.5 flex items-center gap-3"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-xs font-bold text-red-400 shrink-0">
                                            #{pick.pickNumber}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm text-white font-medium">{pick.playerName}</div>
                                            <div className="text-[11px] text-gray-500">{pick.team}</div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {pick.isAutoPick && <span className="text-yellow-400 text-sm" title="Auto-picked">⚡</span>}
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                                pick.pickType === 'batsman'
                                                    ? 'bg-blue-500/10 text-blue-400'
                                                    : pick.pickType === 'bowler'
                                                        ? 'bg-purple-500/10 text-purple-400'
                                                        : 'bg-amber-500/10 text-amber-400'
                                            }`}>
                                                {pick.pickType === 'batsman' ? 'BAT' : pick.pickType === 'bowler' ? 'BOWL' : 'AR'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {oppPicks.length === 0 && (
                                    <div className="text-xs text-gray-600 text-center py-4 border border-dashed border-gray-800 rounded-lg">
                                        No picks yet
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Auto-pick Priority */}
                        {currentRoundPreDraft.length > 0 && (
                            <div className="mt-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                                        Auto-Pick Order
                                    </h4>
                                    <span className="text-[10px] text-gray-600">
                                        {currentTurn?.roundLabel}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mb-2 text-[10px] text-gray-500">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Playing XI</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Impact</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-600 inline-block" /> Squad</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {currentRoundPreDraft.map((entry, i) => {
                                        const isPicked = pickedIds.has(entry.squadPlayerId)
                                        const status = squadStatusMap[entry.squadPlayerId] || 'squad'
                                        const statusColor = status === 'playingXI'
                                            ? 'border-green-500/30 bg-green-500/5'
                                            : status === 'impact'
                                                ? 'border-yellow-500/30 bg-yellow-500/5'
                                                : 'border-gray-700/30 bg-gray-800/30'
                                        const dotColor = status === 'playingXI'
                                            ? 'bg-green-500'
                                            : status === 'impact'
                                                ? 'bg-yellow-500'
                                                : 'bg-gray-600'

                                        return (
                                            <div
                                                key={entry.squadPlayerId}
                                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition ${
                                                    isPicked ? 'opacity-30 line-through' : statusColor
                                                }`}
                                            >
                                                <span className="text-gray-500 font-mono w-4 text-right shrink-0">
                                                    {i + 1}
                                                </span>
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                                                <span className={`flex-1 truncate ${isPicked ? 'text-gray-600' : 'text-gray-300'}`}>
                                                    {entry.playerName}
                                                </span>
                                                <span className="text-[9px] text-gray-600 shrink-0">
                                                    {entry.team}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
