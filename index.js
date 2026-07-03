const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());

const DATA_FILE = path.join(__dirname, 'scores.json');

// 로컬에서 기존 점수 파일 읽기
function loadScores() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error("Error loading scores:", e);
    }
    return {};
}

// 점수 파일 쓰기
function saveScores(scores) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(scores, null, 2), 'utf8');
    } catch (e) {
        console.error("Error saving scores:", e);
    }
}

// 점수 등록 및 등수 조회 API
app.post('/submit_score', (req, res) => {
    const { deviceId, height } = req.body;
    if (!deviceId || typeof height !== 'number') {
        return res.status(400).json({ error: "Invalid parameters. Require 'deviceId' (string) and 'height' (number)." });
    }

    const scores = loadScores();
    // 최고 점수만 갱신
    if (!scores[deviceId] || scores[deviceId] < height) {
        scores[deviceId] = height;
        saveScores(scores);
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
app.get('/get_rankings', (req, res) => {
    const scores = loadScores();
    const sortedScores = Object.entries(scores)
        .map(([id, score]) => ({ id, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    res.json(sortedScores);
});

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  AllCube Leaderboard Web Server Started Successfully!`);
    console.log(`  Running on http://localhost:${PORT}`);
    console.log(`  Press Ctrl+C to stop.`);
    console.log(`=======================================================`);
});