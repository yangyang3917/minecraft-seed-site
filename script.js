// 全局变量
let allSeeds = [];
let displayedSeeds = [];
let currentIndex = 0;
const SEEDS_PER_LOAD = 50;
let filters = {
    platforms: ['java', 'bedrock'],
    versions: [],
    features: ['terrain', 'structure', 'chest'],
    searchText: ''
};
let allVersions = [
    '1.12', '1.16', '1.16.1', '1.17', '1.18', '1.19', 
    '1.19.2','1.20', '1.20.1', '1.20.2', '1.20.3',
    '1.21', '1.21.1', '1.21.2', '1.21.3', '1.21.4', 
    '1.21.5', '1.21.6', '1.21.7', '1.21.8', '1.21.9', 
    '1.21.10', '1.21.11','1.21.12'
];

// DOM元素
let seedsContainer, seedCount, loadingIndicator, noResults;
let backToTopBtn, copyToast;
let searchInput, searchBtn, resetBtn;
let themeToggle;

// 解析版本号
function parseVersion(versionStr) {
    // 处理类似 "1.21+" 的格式
    const version = versionStr.replace('+', '');
    const parts = version.split('.').map(Number);
    return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0,
        isPlus: versionStr.endsWith('+')
    };
}

// 检查版本是否匹配（支持区间）
function versionMatches(seedVersion, filterVersion) {
    // 解析版本
    const seedVer = parseVersion(seedVersion);
    const filterVer = parseVersion(filterVersion);
    
    // 如果种子版本是范围（如"1.21+"）
    if (seedVer.isPlus) {
        // 如果过滤版本也是范围
        if (filterVer.isPlus) {
            // 两个范围版本比较：检查是否有重叠
            // 例如：种子版本"1.21+" 和 过滤版本"1.20+" 应该匹配
            if (seedVer.major !== filterVer.major) {
                return seedVer.major === filterVer.major;
            }
            return seedVer.minor <= filterVer.minor; // 种子版本范围应该包含过滤版本
        } else {
            // 种子版本是范围，过滤版本是具体版本
            // 例如：种子版本"1.21+" 应该匹配 过滤版本"1.21.5"
            if (seedVer.major !== filterVer.major) return false;
            if (seedVer.minor !== filterVer.minor) return false;
            return true; // 只要主版本和次版本相同就匹配
        }
    }
    // 如果过滤版本是范围（如"1.21+"）
    else if (filterVer.isPlus) {
        // 处理 "1.21+" 这种范围
        if (seedVer.major !== filterVer.major) return false;
        if (seedVer.minor < filterVer.minor) return false;
        return true;
    } else {
        // 精确匹配
        return seedVersion === filterVersion;
    }
}

// 初始化函数
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    seedsContainer = document.getElementById('seeds-container');
    seedCount = document.getElementById('seed-count');
    loadingIndicator = document.getElementById('loading-indicator');
    noResults = document.getElementById('no-results');
    backToTopBtn = document.getElementById('back-to-top');
    copyToast = document.getElementById('copy-toast');
    searchInput = document.getElementById('search-input');
    searchBtn = document.getElementById('search-btn');
    resetBtn = document.getElementById('reset-btn');
    themeToggle = document.getElementById('theme-toggle');
    
    // 加载数据
    Promise.all([
        loadSeeds(),
        loadNotice()
    ]).then(() => {
        initializeVersionFilters();
        setupEventListeners();
        applyFilters();
        setupInfiniteScroll();
        setupTheme();
    }).catch(error => {
        console.error('初始化错误:', error);
        seedsContainer.innerHTML = '<p class="error">加载数据失败，请刷新页面重试。</p>';
    });
});

// 加载种子数据
async function loadSeeds() {
    try {
        const response = await fetch('seeds.json');
        if (!response.ok) throw new Error('网络响应不正常');
        
        const data = await response.json();
        
        // 对种子进行排序
        allSeeds = data.seeds.sort((a, b) => {
            // 按版本排序（从新到旧）
            const versionA = parseVersion(a.version);
            const versionB = parseVersion(b.version);
            if (versionB.major !== versionA.major) return versionB.major - versionA.major;
            if (versionB.minor !== versionA.minor) return versionB.minor - versionA.minor;
            if (versionB.patch !== versionA.patch) return versionB.patch - versionA.patch;
            
            // 相同版本下Java版在前
            if (a.platform === 'java' && b.platform !== 'java') return -1;
            if (a.platform !== 'java' && b.platform === 'java') return 1;
            
            // 相同平台下种子值从小到大
            return parseInt(a.seed) - parseInt(b.seed);
        });
        
        // 初始化版本过滤器（全选）
        filters.versions = [...allVersions];
    } catch (error) {
        console.error('加载种子数据失败:', error);
        throw error;
    }
}

// 加载公告
async function loadNotice() {
    try {
        const response = await fetch('notice.json');
        if (!response.ok) return;
        
        const noticeData = await response.json();
        const lastNoticeDate = localStorage.getItem('last_notice_date');
        
        // 如果日期不同，显示公告
        if (lastNoticeDate !== noticeData.date) {
            showNotice(noticeData.notice, noticeData.date);
        }
    } catch (error) {
        console.log('无公告或加载失败:', error);
    }
}

// 显示公告模态框
function showNotice(text, date) {
    const modal = document.getElementById('notice-modal');
    const noticeText = document.getElementById('notice-text');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const closeNoticeBtn = document.getElementById('close-notice-modal-btn');
    const dismissBtn = document.getElementById('dismiss-notice-btn');
    
    if (!modal || !noticeText) return;
    
    noticeText.textContent = text;
    modal.classList.remove('hidden');
    
    // 关闭公告事件
    const closeNotice = () => {
        modal.classList.add('hidden');
    };
    
    // 关闭按钮事件
    closeModalBtn?.addEventListener('click', closeNotice);
    closeNoticeBtn?.addEventListener('click', closeNotice);
    
    // 不再显示按钮事件
    dismissBtn?.addEventListener('click', () => {
        localStorage.setItem('last_notice_date', date);
        closeNotice();
    });
    
    // 点击遮罩层关闭
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeNotice();
        }
    });
    
    // ESC键关闭
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeNotice();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

// 初始化版本过滤器
function initializeVersionFilters() {
    const versionOptions = document.querySelector('.version-options');
    if (!versionOptions) return;
    
    versionOptions.innerHTML = allVersions.map(version => `
        <label class="filter-checkbox">
            <input type="checkbox" name="versions" value="${version}" checked>
            <span class="checkbox-custom"></span>
            <span>${version}</span>
        </label>
    `).join('');
}

// 设置事件监听器
function setupEventListeners() {
    // 平台过滤
    document.querySelectorAll('input[name="platform"]').forEach(checkbox => {
        checkbox.addEventListener('change', updatePlatformFilter);
    });
    
    // 版本过滤
    document.addEventListener('change', function(e) {
        if (e.target.name === 'versions') {
            updateVersionFilter();
        }
    });
    
    // 特点过滤
    document.querySelectorAll('input[name="features"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateFeaturesFilter);
    });
    
    // 搜索
    searchBtn.addEventListener('click', () => {
        filters.searchText = searchInput.value.trim();
        applyFilters();
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            filters.searchText = searchInput.value.trim();
            applyFilters();
        }
    });
    
    // 重置
    resetBtn.addEventListener('click', resetFilters);
    
    // 主题切换
    themeToggle.addEventListener('click', toggleTheme);
    
    // 返回顶部
    backToTopBtn.addEventListener('click', scrollToTop);
    
    // 滚动监听
    window.addEventListener('scroll', handleScroll);
}

// 更新平台过滤器
function updatePlatformFilter() {
    const selectedPlatforms = Array.from(document.querySelectorAll('input[name="platform"]:checked'))
        .map(cb => cb.value);
    filters.platforms = selectedPlatforms.length > 0 ? selectedPlatforms : [];
    applyFilters();
}

// 更新版本过滤器
function updateVersionFilter() {
    const selectedVersions = Array.from(document.querySelectorAll('input[name="versions"]:checked'))
        .map(cb => cb.value);
    filters.versions = selectedVersions.length > 0 ? selectedVersions : [];
    applyFilters();
}

// 更新特点过滤器
function updateFeaturesFilter() {
    const selectedFeatures = Array.from(document.querySelectorAll('input[name="features"]:checked'))
        .map(cb => cb.value);
    filters.features = selectedFeatures.length > 0 ? selectedFeatures : [];
    applyFilters();
}

// 重置过滤器
function resetFilters() {
    // 重置平台
    document.querySelectorAll('input[name="platform"]').forEach(cb => {
        cb.checked = true;
    });
    filters.platforms = ['java', 'bedrock'];
    
    // 重置版本
    document.querySelectorAll('input[name="versions"]').forEach(cb => {
        cb.checked = true;
    });
    filters.versions = [...allVersions];
    
    // 重置特点
    document.querySelectorAll('input[name="features"]').forEach(cb => {
        cb.checked = true;
    });
    filters.features = ['terrain', 'structure', 'chest'];
    
    // 重置搜索
    searchInput.value = '';
    filters.searchText = '';
    
    applyFilters();
}

// 应用过滤器
function applyFilters() {
    displayedSeeds = allSeeds.filter(seed => {
        // 平台过滤
        if (!filters.platforms.includes(seed.platform)) {
            return false;
        }
        
        // 版本过滤
        const versionMatch = filters.versions.some(filterVersion => 
            versionMatches(seed.version, filterVersion)
        );
        if (!versionMatch) {
            return false;
        }
        
        // 特点过滤
        const featureMatch = seed.features && seed.features.some(feature => 
            filters.features.includes(feature)
        );
        if (!featureMatch) {
            return false;
        }
        
        // 搜索过滤
        if (filters.searchText && !seed.description.toLowerCase().includes(filters.searchText.toLowerCase())) {
            return false;
        }
        
        return true;
    });
    
    currentIndex = 0;
    renderSeeds();
}

// 渲染种子
function renderSeeds() {
    // 清空容器
    seedsContainer.innerHTML = '';
    
    // 显示或隐藏无结果提示
    if (displayedSeeds.length === 0) {
        noResults.classList.remove('hidden');
        loadingIndicator.classList.add('hidden');
    } else {
        noResults.classList.add('hidden');
        // 加载第一批种子
        loadMoreSeeds();
    }
    
    // 更新计数
    seedCount.textContent = displayedSeeds.length;
}

// 加载更多种子
function loadMoreSeeds() {
    const seedsToShow = displayedSeeds.slice(currentIndex, currentIndex + SEEDS_PER_LOAD);
    
    seedsToShow.forEach(seed => {
        const seedCard = createSeedCard(seed);
        seedsContainer.appendChild(seedCard);
    });
    
    currentIndex += seedsToShow.length;
    
    // 隐藏加载指示器（如果没有更多种子）
    if (currentIndex >= displayedSeeds.length) {
        loadingIndicator.classList.add('hidden');
    } else {
        loadingIndicator.classList.remove('hidden');
    }
}

// 创建种子卡片
function createSeedCard(seed) {
    const card = document.createElement('div');
    card.className = 'seed-card';
    
    // 图片路径
    const imagePath = `image/${seed.seed}.png`;
    
    // 平台显示文本
    const platformText = seed.platform === 'java' ? 'Java版' : '基岩版';
    
    // 坐标显示文本
    const coordinateText = seed.is_spawn_point 
        ? '坐标：出生点' 
        : `坐标：X: ${seed.position_X}, Y: ${seed.position_Y}, Z: ${seed.position_Z}`;
    
    // 特点标签
    const featureTags = seed.features ? seed.features.map(feature => {
        const featureText = {
            'terrain': '地形类',
            'structure': '结构类',
            'chest': '宝箱类'
        }[feature] || feature;
        return `<span class="feature-tag ${feature}">${featureText}</span>`;
    }).join('') : '';
    
    card.innerHTML = `
        ${seed.seed ? 
            `<img data-src="${imagePath}" alt="种子${seed.seed}的图片" class="seed-image" style="display:none;" onerror="this.style.display='none'; this.parentNode.querySelector('.image-placeholder').style.display='flex';">` : 
            ''
        }
        <div class="image-placeholder" style="${seed.seed ? '' : ''}"></div>
        <div class="seed-content">
            <div class="seed-meta">
                <div class="seed-platform">
                    <span class="platform-icon ${seed.platform}">${platformText}</span>
                    <span class="seed-version">${seed.version}</span>
                </div>
                <div class="seed-coordinate">${coordinateText}</div>
            </div>
            <div class="seed-features">${featureTags}</div>
            <p class="seed-description">${seed.description}</p>
            <div class="seed-value">${seed.seed}</div>
            <button class="copy-btn" data-seed="${seed.seed}">复制种子</button>
        </div>
    `;
    
    // 添加复制事件
    const copyBtn = card.querySelector('.copy-btn');
    copyBtn.addEventListener('click', () => copySeedToClipboard(seed.seed, copyBtn));
    
    // 延迟加载并缓存图片（先检查 Cache Storage）
    (async () => {
        const imgEl = card.querySelector('.seed-image');
        const placeholder = card.querySelector('.image-placeholder');
        if (!imgEl) return;
        try {
            const src = imgEl.getAttribute('data-src');
            const finalSrc = await ensureImageCached(src);
            imgEl.src = finalSrc;
            imgEl.style.display = '';
            if (placeholder) placeholder.style.display = 'none';
        } catch (e) {
            // 保持占位符显示
            console.warn('图片加载或缓存失败:', e);
        }
    })();
    
    return card;
}

// 确保图片被缓存：优先使用 Cache Storage 中的缓存，否则抓取并存入缓存
async function ensureImageCached(url) {
    if (!url) return url;
    if (!('caches' in window)) return url;
    try {
        const cache = await caches.open('seed-images');
        const cachedResponse = await cache.match(url);
        if (cachedResponse) {
            const blob = await cachedResponse.blob();
            return URL.createObjectURL(blob);
        }

        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Network response was not ok');
        // 将响应放入缓存（clone 因为 response 流只能读取一次）
        await cache.put(url, response.clone());
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (err) {
        console.warn('ensureImageCached error:', err);
        return url;
    }
}
// 复制种子到剪贴板
async function copySeedToClipboard(seed, button) {
    try {
        await navigator.clipboard.writeText(seed);
        
        // 显示成功提示
        showCopyToast('✅ 种子已复制到剪贴板！');
        
        // 按钮反馈效果
        if (button) {
            const originalText = button.textContent;
            button.textContent = '已复制';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        }
    } catch (err) {
        console.error('复制失败:', err);
        showCopyToast('❌ 复制失败，请手动复制');
    }
}

// 显示复制提示
function showCopyToast(message) {
    copyToast.textContent = message;
    copyToast.classList.remove('hidden');
    
    setTimeout(() => {
        copyToast.classList.add('hidden');
    }, 3000);
}

// 无限滚动
function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && currentIndex < displayedSeeds.length) {
            loadMoreSeeds();
        }
    }, {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    });
    
    observer.observe(loadingIndicator);
}

// 滚动到顶部
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// 处理滚动
function handleScroll() {
    // 显示/隐藏返回顶部按钮
    if (window.scrollY > window.innerHeight) {
        backToTopBtn.classList.remove('hidden');
        backToTopBtn.classList.add('visible');
    } else {
        backToTopBtn.classList.remove('visible');
        backToTopBtn.classList.add('hidden');
    }
}

// 主题设置
function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    themeToggle.addEventListener('click', toggleTheme);
}

// 切换主题
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

// 更新主题图标
function updateThemeIcon(theme) {
    const themeIcon = themeToggle.querySelector('.theme-icon');
    themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
}