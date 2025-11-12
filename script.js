// 等待 HTML 載入完成
window.addEventListener('load', () => {

    // --- A. 取得 HTML 元素 ---
    const video = document.getElementById('video-feed');
    const canvas = document.getElementById('display-canvas');
    const ctx = canvas.getContext('2d');

    // UI 控制項
    const durationSlider = document.getElementById('duration-slider');
    const durationLabel = document.getElementById('duration-label');
    const slicesSlider = document.getElementById('slices-slider');
    const slicesLabel = document.getElementById('slices-label');

    // --- B. 全域變數 ---
    let frameBuffer = []; // 我們的影像緩衝區
    let bufferDurationSeconds = 1.0; // x 秒 (預設)
    let sliceCount = 5; // y 等分 (預設)
    let maxBufferSize = 60; // 緩衝區最大幀數 (假設 60fps)

    // --- C. 啟動相機 ---
    async function setupCamera() {
        try {
            // 請求相機權限
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment', // 優先使用後置鏡頭
                    width: { ideal: 1920 }, // 嘗試取得 1080p
                    height: { ideal: 1080 }
                }
            });

            // 將相機串流綁定到 video 元素
            video.srcObject = stream;
            video.play();

            // 監聽 video 是否已準備好
            video.onloadedmetadata = () => {
                console.log("相機已啟動");
                
                // 根據影片的實際大小，設定 Canvas 的解析度
                // 這樣可以 1:1 繪製，效能最好
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                // 啟動渲染迴圈
                renderLoop();
            };

        } catch (err) {
            console.error("相機啟動失敗:", err);
            alert("無法存取相機。請檢查權限並確保使用 HTTPS 連線。");
        }
    }

    // --- D. 更新控制項參數 ---
    function updateParameters() {
        // 從 Slider 讀取 'x' (秒數)
        bufferDurationSeconds = parseFloat(durationSlider.value);
        durationLabel.textContent = bufferDurationSeconds.toFixed(1);
        
        // 假設 60 FPS 來計算緩衝區大小
        // (這只是估算，requestAnimationFrame 會盡力而為)
        maxBufferSize = Math.round(bufferDurationSeconds * 60);

        // 從 Slider 讀取 'y' (張數)
        sliceCount = parseInt(slicesSlider.value);
        slicesLabel.textContent = sliceCount;
    }

    // --- E. 影像緩衝邏輯 ---
    function captureFrameToBuffer() {
        // ⚠️ 效能警告：
        // 每次都建立新的 <canvas> 來存儲一幀畫面是
        // 消耗記憶體且效能較差的做法。
        // 但這是最容易理解的「緩衝」實作。
        
        // 1. 建立一個暫時的、隱藏的 canvas 來儲存這一幀
        const bufferCanvas = document.createElement('canvas');
        bufferCanvas.width = canvas.width;
        bufferCanvas.height = canvas.height;
        const bufferCtx = bufferCanvas.getContext('2d');
        
        // 2. 把當前 video 的畫面畫到這個暫時 canvas 上
        bufferCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 3. 將這個存好畫面的 canvas 存入緩衝區陣列
        frameBuffer.push(bufferCanvas);
        
        // 4. 維護緩衝區大小：如果超過 x 秒的量，就丟掉最舊的一幀
        while (frameBuffer.length > maxBufferSize) {
            frameBuffer.shift(); // 移除陣列的第一個 (最舊的)
        }
    }

    // --- F. 影像疊合邏輯 (核心！) ---
    function compositeFrames() {
        if (frameBuffer.length === 0) return; // 如果緩衝區是空的，就先不做事

        // 1. 清空主畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 2. 計算透明度
        // 我們總共有 (y 張舊圖 + 1 張當前圖) = (sliceCount + 1) 張圖要疊
        const alpha = 1.0 / (sliceCount + 1);
        ctx.globalAlpha = alpha;

        // 3. 繪製緩衝區中的 y 張圖片
        const totalFrames = frameBuffer.length;
        if (totalFrames > 1) {
            // 計算 y 等分的索引
            const step = (totalFrames - 1) / (sliceCount - 1);
            
            for (let i = 0; i < sliceCount; i++) {
                // 找到對應的索引
                let index = 0;
                if (i === 0) {
                    index = 0; // 第一張總是取最舊的
                } else {
                    index = Math.round(i * step);
                }
                
                // 確保索引在範圍內
                if (index < frameBuffer.length) {
                    const frameToDraw = frameBuffer[index];
                    ctx.drawImage(frameToDraw, 0, 0, canvas.width, canvas.height);
                }
            }
        }
        
        // 4. 繪製「當前」的影像
        // (我們也用一樣的透明度去畫它)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 5. 恢復透明度，以免影響其他繪圖
        ctx.globalAlpha = 1.0;
    }


    // --- G. 渲染迴圈 (App 的心跳) ---
    function renderLoop() {
        // 1. 更新使用者設定的參數
        updateParameters();
        
        // 2. 從 video 抓一幀畫面存入緩衝區
        captureFrameToBuffer();
        
        // 3. 執行疊合邏輯並畫到主畫布上
        compositeFrames();

        // 4. 要求瀏覽器在下一次重繪時，再次呼叫此函式
        requestAnimationFrame(renderLoop);
    }

    // --- H. 啟動 App ---
    // 監聽 Slider 的變化
    durationSlider.addEventListener('input', updateParameters);
    slicesSlider.addEventListener('input', updateParameters);
    
    // 啟動相機
    setupCamera();
});