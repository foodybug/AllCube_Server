const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// kvdb.io 고유 데이터베이스 버킷 주소 설정
const BUCKET_ID = "allcube_bucket_db_861d7f2"; 
const DB_URL = `https://kvdb.io/${BUCKET_ID}/global_scores`;

// kvdb.io에서 비동기로 점수 데이터 로드
async function loadScores() {
    try {
        const response = await fetch(DB_URL);
        if (response.status === 200) {
            const text = await response.text();
            return JSON.parse(text) || {};
        }
    } catch (e) {
        console.error("Error loading scores from kvdb:", e);
    }
    return {};
}

// kvdb.io에 비동기로 점수 데이터 갱신 저장
async function saveScores(scores) {
    try {
        await fetch(DB_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scores)
        });
    } catch (e) {
        console.error("Error saving scores to kvdb:", e);
    }
}

// 점수 등록 및 등수 조회 API
app.post('/submit_score', async (req, res) => {
    const { deviceId, height } = req.body;
    if (!deviceId || typeof height !== 'number') {
        return res.status(400).json({ error: "Invalid parameters. Require 'deviceId' (string) and 'height' (number)." });
    }

    const scores = await loadScores();
    // 최고 점수만 갱신
    if (!scores[deviceId] || scores[deviceId] < height) {
        scores[deviceId] = height;
        await saveScores(scores);
    }

    // 모든 플레이어의 점수를 내림차순 정렬
    const sortedScores = Object.entries(scores)
        .map(([id, score]) => ({ id, score }))
        .sort((a, b) => b.score - a.score);

    // 등수 계산 (동점자는 동일 등수 부여)
    let rank = 1;
    let rankIndex = 1;
    for (let i = 0; i < sortedScores.length; i++) {
        if (i > 0 && sortedScores[i].score < sortedScores[i - 1].score) {
            rank = rankIndex;
        }
        if (sortedScores[i].id === deviceId) {
            break;
        }
        rankIndex++;
    }

    const totalPlayers = sortedScores.length;
    const topPercentage = (rank / totalPlayers) * 100.0;

    console.log(`[Score Submitted] Device: ${deviceId}, Height: ${height}m -> Rank: ${rank}/${totalPlayers} (Top ${topPercentage.toFixed(2)}%)`);

    res.json({
        rank: rank,
        topPercentage: parseFloat(topPercentage.toFixed(2)),
        totalPlayers: totalPlayers
    });
});

// 상위 10위 리더보드 가져오기 API (선택사항)
app.get('/get_rankings', async (req, res) => {
    const scores = await loadScores();
    const sortedScores = Object.entries(scores)
        .map(([id, score]) => ({ id, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    res.json(sortedScores);
});

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  AllCube Leaderboard Web Server Started Successfully!`);
    console.log(`  Running on port: ${PORT}`);
    console.log(`=======================================================`);
});