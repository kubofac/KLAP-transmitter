'use strict';

// ------------------------------------------------------------------
// 1. 定数とDOM要素
// ------------------------------------------------------------------

// 【重要】ESP32コードと完全に一致させる
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const DEVICE_NAME = 'NRF_Gateway_A'; // 接続したいESP32の正確な名前

// ★★★ 繰り返し送信のための設定 ★★★
const REPEAT_COUNT = 20;     // 送信回数
const REPEAT_INTERVAL_MS = 1000; // 送信間隔 (1秒)

let bleCharacteristic = null;
let currentTransmitInterval = null; // 繰り返し送信を管理するID

const connectButton = document.getElementById('connectButton');
const sendButton = document.getElementById('sendButton');
const messageInput = document.getElementById('messageInput');
const statusMessage = document.getElementById('statusMessage');
const logDiv = document.getElementById('log');

// ------------------------------------------------------------------
// 2. ヘルパー関数
// ------------------------------------------------------------------

function log(message, className = '') {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = `${new Date().toLocaleTimeString()} | ${message}`; // タイムスタンプを追加
    logDiv.prepend(p);
}

function updateStatus(message, isConnected) {
    statusMessage.textContent = message;
    statusMessage.className = isConnected ? 'success' : 'error';
    sendButton.disabled = !isConnected;
    connectButton.disabled = isConnected;
    connectButton.textContent = isConnected ? '✅ 接続中' : '🔌 BLEデバイスに接続';
}

/**
 * 進行中の繰り返し送信を停止する
 */
function stopRepeatTransmission() {
    if (currentTransmitInterval !== null) {
        clearInterval(currentTransmitInterval);
        currentTransmitInterval = null;
        log('繰り返し送信を停止しました。');
    }
}

// ------------------------------------------------------------------
// 3. 接続処理
// ------------------------------------------------------------------

connectButton.addEventListener('click', async () => {
    updateStatus('接続中...', false);
    log('デバイスの検索を開始...');
    
    try {
        // ユーザーにデバイスを選択させる（名前でフィルタリング）
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ name: DEVICE_NAME }], 
            optionalServices: [SERVICE_UUID] 
        });

        log(`デバイスに接続中: ${device.name}`);
        const server = await device.gatt.connect();
        
        // 切断イベントのリスナー
        device.addEventListener('gattserverdisconnected', () => {
            log('デバイスが切断されました。', 'error');
            stopRepeatTransmission(); // 切断時に繰り返し送信も停止
            bleCharacteristic = null;
            updateStatus('未接続', false);
        });

        const service = await server.getPrimaryService(SERVICE_UUID);
        bleCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

        updateStatus('接続完了', true);
        log('接続完了。メッセージを送信できます。', 'success');

    } catch (error) {
        log(`接続エラー: ${error.message}`, 'error');
        updateStatus('未接続', false);
    }
});

// ------------------------------------------------------------------
// 4. 送信処理 (書き込み)
// ------------------------------------------------------------------

/**
 * メッセージを指定回数、指定間隔でBLE経由で送信する
 * @param {string} message 送信するメッセージ
 */
async function sendRobustMessage(message) {
    if (!bleCharacteristic) {
        log('エラー: 接続されていません。', 'error');
        return;
    }
    
    // 進行中の送信があれば停止
    stopRepeatTransmission(); 

    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    let count = 0;

    log(`繰り返し送信開始: "${message}" (${REPEAT_COUNT}回 @ ${REPEAT_INTERVAL_MS}ms)`, 'success');
    sendButton.disabled = true; // 送信中はボタンを無効化
    
    currentTransmitInterval = setInterval(async () => {
        try {
            if (count >= REPEAT_COUNT) {
                stopRepeatTransmission();
                log(`全ての送信が完了しました (${REPEAT_COUNT}回)。`);
                sendButton.disabled = false; // 完了後にボタンを有効化
                messageInput.value = ''; // 入力欄をクリア
                return;
            }

            // BLEキャラクタリスティックへ書き込み
            await bleCharacteristic.writeValue(data);
            count++;
            
            log(`送信 ${count}/${REPEAT_COUNT}回目 成功`);

        } catch (error) {
            log(`致命的な送信エラー: ${error.message}`, 'error');
            stopRepeatTransmission(); // エラー発生時は即座に停止
            sendButton.disabled = false;
        }
    }, REPEAT_INTERVAL_MS);
}


sendButton.addEventListener('click', () => {
    // 既存の入力チェック
    const message = messageInput.value;
    if (!message) {
        log('メッセージを入力してください。', 'error');
        return;
    }
    
    // NRF24L01は通常最大32バイトのペイロード制限がある
    if (message.length > 25) { 
        log('メッセージが長すぎます（25文字以下推奨）。', 'error');
        return;
    }

    // 繰り返し送信関数を呼び出す
    sendRobustMessage(message);
});