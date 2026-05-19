import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../utils/api'

interface Player {
    playerId: string
    playerName: string
    role: string
    team: string
}

type Tab = 'batsmen' | 'bowlers' | 'allrounders'

export default function PreDraft() {
    const { roomId, matchId: paramMatchId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const stateMode = (location.state as any)?.mode as string | undefined

    const [activeTab, setActiveTab] = useState<Tab>('batsmen')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [showInvite, setShowInvite] = useState(false)
    const [showDone, setShowDone] = useState(false)
    const [isRandomRoom, setIsRandomRoom] = useState(false)
    const [inviteCode, setInviteCode] = useState('')
    const [createdRoomId, setCreatedRoomId] = useState<string | null>(roomId || null)

    const [matchInfo, setMatchInfo] = useState<any>(null)
    const [pool, setPool] = useState<{
        batsmen: Player[]
        bowlers: Player[]
        allrounders: Player[]
    }>({ batsmen: [], bowlers: [], allrounders: [] })

    const [ranked, setRanked] = useState<{
        batsmen: Player[]
        bowlers: Player[]
        allrounders: Player[]
    }>({ batsmen: [], bowlers: [], allrounders: [] })

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const url = roomId
                ? `/rooms/${roomId}/squad`
                : `/matches/${paramMatchId}/squad`
            const squadRes = await api.get(url)
            setMatchInfo(squadRes.data.match)

            const squadPool = {
                batsmen: squadRes.data.batsmen as Player[],
                bowlers: squadRes.data.bowlers as Player[],
                allrounders: squadRes.data.allrounders as Player[]
            }
            setPool(squadPool)

            if (roomId) {
                const predraftRes = await api.get(`/rooms/${roomId}/predraft`)
                const allPlayers = [...squadPool.batsmen, ...squadPool.bowlers, ...squadPool.allrounders]
                const findPlayer = (id: string) => allPlayers.find(p => p.playerId === id)

                if (predraftRes.data.batsmen.length > 0 || predraftRes.data.bowlers.length > 0 || predraftRes.data.allrounders.length > 0) {
                    setRanked({
                        batsmen: predraftRes.data.batsmen.map((e: any) => {
                            const match = findPlayer(e.squadPlayerId)
                            return { playerId: e.squadPlayerId, playerName: e.playerName, role: match?.role || '', team: match?.team || '' }
                        }),
                        bowlers: predraftRes.data.bowlers.map((e: any) => {
                            const match = findPlayer(e.squadPlayerId)
                            return { playerId: e.squadPlayerId, playerName: e.playerName, role: match?.role || '', team: match?.team || '' }
                        }),
                        allrounders: predraftRes.data.allrounders.map((e: any) => {
                            const match = findPlayer(e.squadPlayerId)
                            return { playerId: e.squadPlayerId, playerName: e.playerName, role: match?.role || '', team: match?.team || '' }
                        })
                    })
                }
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const MAX_BATSMEN = 6
    const MAX_BOWLERS = 4
    const MAX_ALLROUNDERS = 4
    const maxMap: Record<Tab, number> = {
        batsmen: MAX_BATSMEN,
        bowlers: MAX_BOWLERS,
        allrounders: MAX_ALLROUNDERS
    }

    const MAX_PER_TEAM: Record<Tab, number> = {
        batsmen: 3,
        bowlers: 2,
        allrounders: 2
    }

    const teamCountInTab = (tab: Tab, team: string) =>
        ranked[tab].filter(p => p.team === team).length

    const isTeamFullInTab = (tab: Tab, team: string) =>
        teamCountInTab(tab, team) >= MAX_PER_TEAM[tab]

    const togglePlayer = (player: Player, tab: Tab) => {
        const current = ranked[tab]
        const exists = current.find(p => p.playerId === player.playerId)
        if (exists) {
            setRanked(prev => ({
                ...prev,
                [tab]: prev[tab].filter(p => p.playerId !== player.playerId)
            }))
        } else {
            if (current.length >= maxMap[tab]) return
            if (isTeamFullInTab(tab, player.team)) return
            setRanked(prev => ({
                ...prev,
                [tab]: [...prev[tab], player]
            }))
        }
    }

    const moveUp = (index: number, tab: Tab) => {
        if (index === 0) return
        const arr = [...ranked[tab]]
        ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
        setRanked(prev => ({ ...prev, [tab]: arr }))
    }

    const moveDown = (index: number, tab: Tab) => {
        const arr = [...ranked[tab]]
        if (index === arr.length - 1) return
            ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
        setRanked(prev => ({ ...prev, [tab]: arr }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            let activeRoomId = createdRoomId

            if (!activeRoomId) {
                const matchId = paramMatchId || matchInfo?.id
                const roomType = stateMode === 'random' ? 'random' : 'friendly'
                const createRes = await api.post('/rooms/create', { matchId, roomType })
                activeRoomId = createRes.data._id
                setCreatedRoomId(activeRoomId)
            }

            await api.post(`/rooms/${activeRoomId}/predraft`, {
                batsmen: ranked.batsmen,
                bowlers: ranked.bowlers,
                allrounders: ranked.allrounders
            })
            setSaved(true)

            const roomRes = await api.get(`/rooms/${activeRoomId}`)
            const isRandom = roomRes.data.roomType === 'random'
            setIsRandomRoom(isRandom)

            if (isRandom) {
                const queueRes = await api.post(`/rooms/${activeRoomId}/queue`)
                if (queueRes.data.matched) {
                    setIsRandomRoom(false)
                }
                setShowDone(true)
            } else if (roomRes.data.status === 'ready' || roomRes.data.status === 'drafting') {
                setShowDone(true)
            } else if (roomRes.data.status === 'waiting') {
                setInviteCode(roomRes.data.inviteCode)
                setShowInvite(true)
            } else {
                setShowDone(true)
            }
        } catch (err: any) {
            console.error(err)
            alert(err.response?.data?.error || 'Error saving')
        } finally {
            setSaving(false)
        }
    }

    const copyCode = () => {
        navigator.clipboard.writeText(inviteCode)
    }

    const currentPool = pool[activeTab]
    const currentRanked = ranked[activeTab]

    const MIN_BATSMEN = MAX_BATSMEN
    const MIN_BOWLERS = MAX_BOWLERS
    const MIN_ALLROUNDERS = MAX_ALLROUNDERS
    const MIN_BAT_PER_TEAM = 2
    const MIN_BOWL_PER_TEAM = 1
    const MIN_AR_PER_TEAM = 1

    const teamHome = matchInfo?.teamHome || ''
    const teamAway = matchInfo?.teamAway || ''

    const teamCount = (tab: Tab, team: string) =>
        ranked[tab].filter(p => p.team === team).length

    const perTeamOk =
        teamCount('batsmen', teamHome) >= MIN_BAT_PER_TEAM &&
        teamCount('batsmen', teamAway) >= MIN_BAT_PER_TEAM &&
        teamCount('bowlers', teamHome) >= MIN_BOWL_PER_TEAM &&
        teamCount('bowlers', teamAway) >= MIN_BOWL_PER_TEAM &&
        teamCount('allrounders', teamHome) >= MIN_AR_PER_TEAM &&
        teamCount('allrounders', teamAway) >= MIN_AR_PER_TEAM

    const canSave =
        ranked.batsmen.length >= MIN_BATSMEN &&
        ranked.bowlers.length >= MIN_BOWLERS &&
        ranked.allrounders.length >= MIN_ALLROUNDERS &&
        perTeamOk

    const tabs: { key: Tab; label: string; count: string }[] = [
        { key: 'batsmen', label: 'Batsmen', count: `${ranked.batsmen.length}/${MIN_BATSMEN}` },
        { key: 'bowlers', label: 'Bowlers', count: `${ranked.bowlers.length}/${MIN_BOWLERS}` },
        { key: 'allrounders', label: 'All-rounders', count: `${ranked.allrounders.length}/${MIN_ALLROUNDERS}` }
    ]

    if (showDone) return (
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
            <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
                <div className="text-5xl">{isRandomRoom ? '🏏' : '✅'}</div>
                <div>
                    <h3 className="text-xl font-semibold mb-2">
                        {isRandomRoom ? "You're in the queue!" : 'Pre-Draft Saved!'}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        {isRandomRoom
                            ? "Your rankings are saved. We'll notify you via email when an opponent is found."
                            : 'Your rankings are locked in. The draft will begin once both players are ready.'}
                    </p>
                </div>
                {isRandomRoom && (
                    <div className="w-full bg-gray-900 rounded-xl px-4 py-3 text-sm text-gray-400 text-left">
                        📧 We'll email you when your opponent is ready.<br/>
                        You can safely close this page.
                    </div>
                )}
                <button
                    onClick={() => navigate('/')}
                    className="w-full bg-green-500 hover:bg-green-400 text-black font-semibold py-4 rounded-xl transition"
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    )

    if (showInvite) return (
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
            <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
                <div className="text-5xl">✅</div>
                <div>
                    <h3 className="text-xl font-semibold mb-2">Pre-Draft Saved!</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        Share this invite code with your friend to start the draft
                    </p>
                </div>
                <div
                    onClick={copyCode}
                    className="w-full bg-gray-900 rounded-xl px-4 py-5 text-center cursor-pointer hover:bg-gray-800 transition"
                >
                    <div className="text-3xl font-mono font-bold tracking-[0.3em] text-green-400">
                        {inviteCode}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">Tap to copy</div>
                </div>
                <button
                    onClick={() => navigate('/')}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-4 rounded-xl transition"
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    )

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <p className="text-gray-400">Loading squad...</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-800">
                <div className="flex items-center gap-3 mb-1">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-gray-400 hover:text-white transition text-sm"
                    >
                        ← Back
                    </button>
                    <div className="text-xs text-gray-400">Pre-Draft</div>
                </div>
                <div className="font-semibold">
                    {matchInfo?.teamHome} vs {matchInfo?.teamAway}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                    {matchInfo && new Date(matchInfo.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 py-3 text-sm font-medium transition ${
                            activeTab === tab.key
                                ? 'text-green-400 border-b-2 border-green-400'
                                : 'text-gray-400'
                        }`}
                    >
                        {tab.label}
                        <div className="text-xs font-normal mt-0.5">{tab.count}</div>
                    </button>
                ))}
            </div>

            {/* Per-team split */}
            <div className="flex gap-4 px-4 py-2 bg-gray-900/50 text-xs">
                <div className={teamCountInTab(activeTab, teamHome) >= MAX_PER_TEAM[activeTab] ? 'text-red-400' : teamCountInTab(activeTab, teamHome) >= (activeTab === 'batsmen' ? MIN_BAT_PER_TEAM : activeTab === 'bowlers' ? MIN_BOWL_PER_TEAM : MIN_AR_PER_TEAM) ? 'text-green-400' : 'text-yellow-400'}>
                    {teamHome}: {teamCountInTab(activeTab, teamHome)}/{MAX_PER_TEAM[activeTab]}
                </div>
                <div className={teamCountInTab(activeTab, teamAway) >= MAX_PER_TEAM[activeTab] ? 'text-red-400' : teamCountInTab(activeTab, teamAway) >= (activeTab === 'batsmen' ? MIN_BAT_PER_TEAM : activeTab === 'bowlers' ? MIN_BOWL_PER_TEAM : MIN_AR_PER_TEAM) ? 'text-green-400' : 'text-yellow-400'}>
                    {teamAway}: {teamCountInTab(activeTab, teamAway)}/{MAX_PER_TEAM[activeTab]}
                </div>
                <div className="text-gray-500 ml-auto">
                    max {MAX_PER_TEAM[activeTab]}/team
                </div>
            </div>

            <div className="flex flex-col md:flex-row max-w-3xl mx-auto">

                {/* Left — available pool */}
                <div className="flex-1 px-4 py-4">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                        Available — tap to rank
                    </div>
                    <div className="flex flex-col gap-2">
                        {currentPool.map(player => {
                            const isRanked = currentRanked.find(p => p.playerId === player.playerId)
                            const isCategoryFull = !isRanked && currentRanked.length >= maxMap[activeTab]
                            const isTeamCapped = !isRanked && isTeamFullInTab(activeTab, player.team)
                            const isDisabled = isCategoryFull || isTeamCapped
                            return (
                                <button
                                    key={player.playerId}
                                    onClick={() => togglePlayer(player, activeTab)}
                                    disabled={isDisabled}
                                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-left transition ${
                                        isRanked
                                            ? 'bg-green-500/20 border border-green-500/50'
                                            : isDisabled
                                                ? 'bg-gray-900/50 opacity-40 cursor-not-allowed'
                                                : 'bg-gray-900 hover:bg-gray-800'
                                    }`}
                                >
                                    <div>
                                        <div className="text-sm font-medium">{player.playerName}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">
                                            {player.team} · {player.role}
                                            {isTeamCapped && !isCategoryFull && (
                                                <span className="text-red-400 ml-1">(team full)</span>
                                            )}
                                        </div>
                                    </div>
                                    {isRanked && (
                                        <span className="text-green-400 text-xs font-bold">
                      #{currentRanked.findIndex(p => p.playerId === player.playerId) + 1}
                    </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Right — ranked list */}
                <div className="flex-1 px-4 py-4 border-t md:border-t-0 md:border-l border-gray-800">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                        Your ranking
                    </div>
                    {currentRanked.length === 0 ? (
                        <p className="text-gray-600 text-sm">
                            Tap players on the left to add them to your ranking.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {currentRanked.map((player, index) => (
                                <div
                                    key={player.playerId}
                                    className="flex items-center gap-3 bg-gray-900 px-3 py-3 rounded-xl"
                                >
                  <span className="text-green-400 font-bold text-sm w-6">
                    {index + 1}
                  </span>
                                    <span className="flex-1 text-sm font-medium">
                    {player.playerName}
                  </span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => moveUp(index, activeTab)}
                                            className="text-gray-400 hover:text-white px-2 py-1 text-xs"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            onClick={() => moveDown(index, activeTab)}
                                            className="text-gray-400 hover:text-white px-2 py-1 text-xs"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            onClick={() => togglePlayer(player, activeTab)}
                                            className="text-red-400 hover:text-red-300 px-2 py-1 text-xs"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3">
                {!canSave && (
                    <div className="text-xs text-gray-400 text-center mb-2">
                        {!perTeamOk ? (
                            <span>Need at least {MIN_BAT_PER_TEAM} bat, {MIN_BOWL_PER_TEAM} bowl, {MIN_AR_PER_TEAM} AR from each team</span>
                        ) : (
                            <span>Min: {MIN_BATSMEN} batsmen, {MIN_BOWLERS} bowlers, {MIN_ALLROUNDERS} all-rounders</span>
                        )}
                    </div>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving || !canSave}
                    className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold py-3 rounded-xl transition"
                >
                    {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Pre-Draft'}
                </button>
            </div>

            {/* Bottom padding for fixed footer */}
            <div className="h-24" />
        </div>
    )
}