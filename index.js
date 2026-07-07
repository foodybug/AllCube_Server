const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// jsonbin-zeta 클라우드 스토리지 빈 주소 설정
const DB_URL = "https://jsonbin-zeta.vercel.app/api/bins/8x1U1T-pZU";

// jsonbin-zeta에서 비동기로 점수 데이터 로드
async function loadScores() {
    let scores = {};
    try {
        const response = await fetch(DB_URL);
        if (response.status === 200) {
            const text = await response.text();
            const parsed = JSON.parse(text || "{}");
            // jsonbin-zeta의 래핑된 데이터 구조가 있는 경우 대응
            scores = parsed.data || parsed || {};
        }
    } catch (e) {
        console.error("Error loading scores from jsonbin-zeta:", e);
    }

    // 100개의 가상 더미 플레이어 데이터를 결정론적 수식으로 자동 주입
    for (let i = 1; i <= 100; i++) {
        const dummyId = `dummy_player_${i}`;
        if (!scores[dummyId]) {
            let score;
            const seed = (i * 37) % 100; // 결정론적 고유 분산 시드
            if (seed < 10) {
                score = 500 + (seed * 35); // 500m ~ 850m
            } else if (seed < 30) {
                score = 250 + (seed * 12); // 250m ~ 490m
            } else if (seed < 70) {
                score = 80 + (seed * 4); // 80m ~ 240m
            } else {
                score = 10 + (seed - 70) * 2; // 10m ~ 70m
            }
            scores[dummyId] = score;
        }
    }

    return scores;
}

// jsonbin-zeta에 비동기로 점수 데이터 갱신 저장
async function saveScores(scores) {
    try {
        await fetch(DB_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scores)
        });
    } catch (e) {
        console.error("Error saving scores to jsonbin-zeta:", e);
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

    // 등수 계산 및 각 항목의 상세 정보가 포함된 랭킹 리스트 구축 (동점자 처리 규칙 적용)
    let rank = 1;
    let rankIndex = 1;
    const scoredListWithRank = [];
    for (let i = 0; i < sortedScores.length; i++) {
        if (i > 0 && sortedScores[i].score < sortedScores[i - 1].score) {
            rank = rankIndex;
        }
        scoredListWithRank.push({
            rank: rank,
            deviceId: sortedScores[i].id,
            height: sortedScores[i].score,
            isSelf: sortedScores[i].id === deviceId
        });
        rankIndex++;
    }

    // 내 디바이스의 데이터 검출
    const myRankItem = scoredListWithRank.find(item => item.isSelf);
    const myRank = myRankItem ? myRankItem.rank : 1;
    const totalPlayers = sortedScores.length;
    const topPercentage = (myRank / totalPlayers) * 100.0;

    // 내 위치(Index)를 기준으로 상위 3명, 하위 3명(총 최대 7명)의 랭킹 윈도우 슬라이싱
    const myIndex = scoredListWithRank.findIndex(item => item.isSelf);
    const startIdx = Math.max(0, myIndex - 3);
    const endIdx = Math.min(scoredListWithRank.length - 1, myIndex + 3);
    const leaderboardWindow = [];
    for (let i = startIdx; i <= endIdx; i++) {
        leaderboardWindow.push(scoredListWithRank[i]);
    }

    console.log(`[Score Submitted] Device: ${deviceId}, Height: ${height}m -> Rank: ${myRank}/${totalPlayers} (Top ${topPercentage.toFixed(2)}%)`);

    res.json({
        rank: myRank,
        topPercentage: parseFloat(topPercentage.toFixed(2)),
        totalPlayers: totalPlayers,
        leaderboardWindow: leaderboardWindow
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