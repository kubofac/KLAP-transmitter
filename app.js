// ------------------------------------------------------------------
// 1. 定数とDOM要素
// ------------------------------------------------------------------

// 【重要】ESP32コードと完全に一致させる
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const DEVICE_NAME = 'NRF_Gateway_A'; // 接続したいESP32の正確な名前

let bleCharacteristic = null;
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
    p.textContent = message;
    logDiv.prepend(p);
}

function updateStatus(message, isConnected) {
    statusMessage.textContent = message;
    statusMessage.className = isConnected ? 'success' : 'error';
    sendButton.disabled = !isConnected;
    connectButton.disabled = isConnected;
    connectButton.textContent = isConnected ? '✅ 接続中' : '🔌 BLEデバイスに接続';
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

sendButton.addEventListener('click', async () => {
    if (!bleCharacteristic) {
        log('エラー: 接続されていません。', 'error');
        return;
    }
    
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

    try {
        // メッセージをバイト配列に変換
        const encoder = new TextEncoder();
        const data = encoder.encode(message);

        // BLEキャラクタリスティックへ書き込み
        await bleCharacteristic.writeValue(data);
        
        log(`送信完了: "${message}"`);
        messageInput.value = ''; // 入力欄をクリア

    } catch (error) {
        log(`送信エラー: ${error.message}`, 'error');
    }
});