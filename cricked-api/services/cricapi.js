const axios = require('axios')
require('dotenv').config()

const BASE_URL = 'https://api.cricapi.com/v1'
const API_KEY = process.env.CRICAPI_KEY

// Get upcoming matches
const getUpcomingMatches = async () => {
    const res = await axios.get(`${BASE_URL}/series_info`, {
        params: { apikey: API_KEY,id: '87c62aac-bc3c-4738-ab93-19da0690488f' }
    })
    return res.data
}

// Get match detail (includes squad if available)
const getMatchDetail = async (matchId) => {
    const res = await axios.get(`${BASE_URL}/match_squad`, {
        params: { apikey: API_KEY, id: matchId }
    })
    return res.data
}

// Get scorecard for a match
const getScorecard = async (matchId) => {
    const res = await axios.get(`${BASE_URL}/match_scorecard`, {
        params: { apikey: API_KEY, id: matchId }
    })
    return res.data
}

const getMatchInfo = async (matchId) => {
    const res = await axios.get(`${BASE_URL}/match_info`, {
        params: { apikey: API_KEY, id: matchId }
    })
    return res.data
}

module.exports = { getUpcomingMatches, getMatchDetail, getScorecard,getMatchInfo }