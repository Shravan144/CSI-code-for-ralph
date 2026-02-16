
const COLS = 10, ROWS = 8, TILE = 72;
const W = COLS * TILE, H = ROWS * TILE;
const RIGHT = 0, DOWN = 1, LEFT = 2, UP = 3;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const DIR_ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const EMPTY = 0, ROAD = 1, HIGHWAY = 2, TOWN = 3, GATE = 4, SPAWN = 5, EXIT = 6;
const GAME_TIME = 180, WIN_REDIRECT = 200, START_ECONOMY = 70;
const CAR_PALETTE = ['#c04444', '#3878b8', '#c8a030', '#38a878', '#b858a0', '#c87030', '#7858b8'];

// Cars (2006) Movie Characters
const CAR_CHARACTERS = [
    { name: 'McQueen',  color: '#d42020', accent: '#f5c518', isTruck: false, face: { eyeH: 1, mouth: 1, brow: 1 },  decal: '95',  bodyStyle: 'racer' },
    { name: 'Mater',    color: '#8b5e34', accent: '#6b4420', isTruck: true,  face: { eyeH: 1, mouth: 1, brow: 0 },  decal: 'tow', bodyStyle: 'truck' },
    { name: 'Sally',    color: '#4a90d9', accent: '#7ab8ff', isTruck: false, face: { eyeH: 0, mouth: 1, brow: 0 },  decal: null,  bodyStyle: 'porsche' },
    { name: 'Doc',      color: '#1a2d45', accent: '#3a6090', isTruck: false, face: { eyeH: -1, mouth: 0, brow: -1 }, decal: '51',  bodyStyle: 'hudson' },
    { name: 'Luigi',    color: '#e8c820', accent: '#f0e060', isTruck: false, face: { eyeH: 0, mouth: 1, brow: 0 },  decal: null,  bodyStyle: 'fiat' },
    { name: 'Ramone',   color: '#6a1b9a', accent: '#ff6d00', isTruck: false, face: { eyeH: 0, mouth: 1, brow: 1 },  decal: null,  bodyStyle: 'lowrider' },
    { name: 'Sheriff',  color: '#2e4033', accent: '#c0c0c0', isTruck: false, face: { eyeH: -1, mouth: 0, brow: -1 }, decal: null,  bodyStyle: 'cruiser' },
    { name: 'Fillmore', color: '#30785a', accent: '#90d8a0', isTruck: true,  face: { eyeH: 0, mouth: 1, brow: 0 },  decal: 'vw',  bodyStyle: 'van' },
    { name: 'Chick',    color: '#48a848', accent: '#c8e020', isTruck: false, face: { eyeH: -1, mouth: -1, brow: -1 }, decal: '86', bodyStyle: 'racer' },
    { name: 'Flo',      color: '#c85098', accent: '#ff80c0', isTruck: false, face: { eyeH: 0, mouth: 1, brow: 0 },  decal: null,  bodyStyle: 'showcar' },
];

// Level configuration [redirectTarget, spawnRate, carSpeed, shuffleInterval(frames), gateToggleInterval, maxCarsOnScreen]
const LEVELS = [
    { target: 15,  spawnRate: 180, speed: 1.1,  shuffleEvery: 0,    gateToggle: 0,    maxCars: 6  },  // L1 intro
    { target: 25,  spawnRate: 140, speed: 1.25, shuffleEvery: 900,  gateToggle: 0,    maxCars: 8  },  // L2 shuffles start
    { target: 35,  spawnRate: 110, speed: 1.4,  shuffleEvery: 700,  gateToggle: 1200, maxCars: 10 },  // L3 gates auto-toggle
    { target: 45,  spawnRate: 85,  speed: 1.6,  shuffleEvery: 500,  gateToggle: 900,  maxCars: 12 },  // L4 intense
    { target: 60,  spawnRate: 65,  speed: 1.8,  shuffleEvery: 400,  gateToggle: 700,  maxCars: 14 },  // L5 final
];
const MAX_LEVEL = LEVELS.length;

// Weather types
const WEATHER_CLEAR = 0, WEATHER_SANDSTORM = 1, WEATHER_NIGHT = 2, WEATHER_RAIN = 3;
const WEATHER_NAMES = ['Clear', 'Sandstorm', 'Night', 'Rain'];
const WEATHER_ICONS = ['\u2600', '\u{1F32A}', '\u{1F319}', '\u{1F327}'];

// ==================== AUDIO ====================
class SFX {
    constructor() { this.ctx = null; }
    init() {
        if (this.ctx) return;
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    _tone(type, freq, freqEnd, dur, vol) {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.type = type;
        o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + dur);
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.start(); o.stop(this.ctx.currentTime + dur);
    }
    crash()    { this._tone('sawtooth', 200, 40, 0.35, 0.22); }
    redirect() { this._tone('sine', 500, 900, 0.18, 0.1); }
    gate()     { this._tone('square', 280, 400, 0.12, 0.07); }
    rotate()   { this._tone('triangle', 450, 600, 0.07, 0.05); }
    combo()    { this._tone('sine', 700, 1200, 0.15, 0.1); }
    powerup()  { this._tone('sine', 400, 800, 0.25, 0.12); }
    win() {
        if (!this.ctx) return;
        [0, 0.12, 0.24, 0.4].forEach((t, i) => {
            const f = [523, 659, 784, 1047][i];
            setTimeout(() => this._tone('sine', f, f * 1.01, 0.3, 0.1), t * 1000);
        });
    }
    lose() { this._tone('sawtooth', 300, 30, 0.7, 0.18); }
}

// ==================== CELL ====================
class Cell {
    constructor(kind, dir, row, col) {
        this.kind = kind; this.dir = dir;
        this.row = row; this.col = col;
        this.rotatable = false;
        this.gateOpen = true;
        this.flashTimer = 0;
    }
    exitDir(carDir) {
        switch (this.kind) {
            case ROAD:    return this.dir;
            case HIGHWAY: return RIGHT;
            case SPAWN:   return RIGHT;
            case EXIT:    return -2;
            case TOWN:    return carDir;
            case GATE:    return this.gateOpen ? RIGHT : -1;
            default:      return -1;
        }
    }
}

// Car expressions: [eyeHeight, mouthCurve, browAngle]
// eyeHeight: 0=normal, 1=wide, -1=squint
// mouthCurve: 1=smile, 0=neutral, -1=worried
// browAngle: 0=none, 1=focused, -1=angry
const CAR_FACES = [
    { eyeH: 0,  mouth: 1,  brow: 0  },  // happy
    { eyeH: 1,  mouth: 0,  brow: 1  },  // focused
    { eyeH: -1, mouth: -1, brow: -1 },  // worried
    { eyeH: 0,  mouth: 1,  brow: 0  },  // cheerful
    { eyeH: 1,  mouth: 0,  brow: -1 },  // determined
    { eyeH: 0,  mouth: -1, brow: 1  },  // nervous
];

// ==================== CAR ====================
class Car {
    constructor(row, col, character = null) {
        this.gRow = row; this.gCol = col;
        this.dir = RIGHT;
        this.x = col * TILE + TILE / 2;
        this.y = row * TILE + TILE / 2;
        this.tx = this.x + TILE;
        this.ty = this.y;
        this.alive = true;
        this.touchedTown = false;
        this.blinkTimer = 80 + Math.floor(Math.random() * 120);
        this.blinking = 0;

        // Assign character from Cars movie
        if (!character) character = CAR_CHARACTERS[Math.floor(Math.random() * CAR_CHARACTERS.length)];
        this.character = character;
        this.color = character.color;
        this.accent = character.accent;
        this.face = character.face;
        this.isTruck = character.isTruck;
        this.bodyStyle = character.bodyStyle;
        this.decal = character.decal;
        this.charName = character.name;

        // Speed
        this.baseSpeed = this.isTruck ? 0.85 : 1.15;
        this.speed = this.baseSpeed;
    }
}

// ==================== GAME ====================
class Game {
    constructor() {
        this.cvs = document.getElementById('game-canvas');
        this.c = this.cvs.getContext('2d');
        this.cvs.width = W;
        this.cvs.height = H;

        this.sfx = new SFX();
        this.grid = [];
        this.cars = [];

        // Core stats
        this.economy = START_ECONOMY;
        this.score = 0;
        this.totalCars = 0;
        this.redirected = 0;
        this.bypassed = 0;
        this.timeLeft = GAME_TIME;
        this.hiScore = parseInt(localStorage.getItem('hhHiScore')) || 0;

        // State
        this.running = false;
        this.paused = false;
        this.over = false;
        this.frame = 0;

        // Level system
        this.level = 1;
        this.levelRedirected = 0;  // redirects in current level
        this.levelConfig = LEVELS[0];

        // Spawn / difficulty
        this.spawnCD = 0;
        this.spawnRate = this.levelConfig.spawnRate;
        this.minSpawnRate = 40;
        this.diffTimer = 0;

        // Shuffle & gate-toggle timers
        this.shuffleTimer = 0;
        this.gateToggleTimer = 0;

        // Combo system
        this.combo = 1;
        this.comboCount = 0;  // consecutive redirects
        this.comboTimer = 0;  // frames left before combo resets

        // Weather system
        this.weather = WEATHER_CLEAR;
        this.weatherTimer = 0;
        this.nextWeatherChange = 900 + Math.floor(Math.random() * 600); // 15-25 sec

        // Power-ups
        this.powers = { slow: 3, clear: 2, boost: 2 };
        this.slowActive = 0; // frames remaining

        // Screen shake
        this.shaking = false;

        // Floating score texts
        this.floatingTexts = [];  // {x, y, text, color, life, maxLife}

        // Hover tracking
        this.hoverRow = -1;
        this.hoverCol = -1;

        // Town growth tier (0=poor, 1=normal, 2=thriving)
        this.townTier = 1;

        // DOM refs
        this.eFill  = document.getElementById('economy-fill');
        this.eVal   = document.getElementById('economy-value');
        this.ePct   = document.getElementById('redirect-percent');
        this.eScore = document.getElementById('score-display');
        this.eHi    = document.getElementById('highscore-display');
        this.eTime  = document.getElementById('timer-display');
        this.eCombo = document.getElementById('combo-display');
        this.eDiff  = document.getElementById('difficulty-display');
        this.ePart  = document.getElementById('particles-container');
        this.eWeatherOverlay = document.getElementById('weather-overlay');
        this.eWeatherIcon = document.getElementById('weather-icon');
        this.eWeatherText = document.getElementById('weather-text');
        this.eComboPopup = document.getElementById('combo-popup');
        this.eStage = document.getElementById('canvas-stage');
        this.eLevel = document.getElementById('level-display');
        this.eLevelBanner = document.getElementById('level-banner');
        this.eShuffleWarn = document.getElementById('shuffle-warn');

        this.buildMap();
        this.bindEvents();
        this.refreshUI();
        this.eHi.textContent = this.hiScore;
        this.draw();
    }

    // ==================== MAP ====================
    buildMap() {
        this.grid = [];
        for (let r = 0; r < ROWS; r++) {
            const row = [];
            for (let c = 0; c < COLS; c++) row.push(new Cell(EMPTY, RIGHT, r, c));
            this.grid.push(row);
        }
        const S = (r, c, kind, dir = RIGHT, rot = false) => {
            const cell = this.grid[r][c];
            cell.kind = kind; cell.dir = dir; cell.rotatable = rot;
        };
        // Row 0 — Top Highway (gated)
        S(0, 0, SPAWN); S(0, 1, HIGHWAY);
        S(0, 2, ROAD, RIGHT, true); S(0, 3, GATE);
        S(0, 4, HIGHWAY); S(0, 5, HIGHWAY);
        S(0, 6, GATE); S(0, 7, ROAD, RIGHT, true);
        S(0, 8, HIGHWAY); S(0, 9, EXIT);
        // Row 1 — Connectors
        for (let c = 1; c <= 8; c++) S(1, c, ROAD, RIGHT, true);
        // Row 2 — Gated Highway
        S(2, 0, SPAWN); S(2, 1, HIGHWAY);
        S(2, 2, ROAD, RIGHT, true); S(2, 3, GATE);
        S(2, 4, HIGHWAY); S(2, 5, HIGHWAY);
        S(2, 6, GATE); S(2, 7, ROAD, RIGHT, true);
        S(2, 8, HIGHWAY); S(2, 9, EXIT);
        // Row 3 — Town top
        S(3, 2, ROAD, RIGHT, true);
        S(3, 3, TOWN); S(3, 4, TOWN); S(3, 5, TOWN); S(3, 6, TOWN);
        S(3, 7, ROAD, RIGHT, true);
        // Row 4 — Town bottom
        S(4, 2, ROAD, RIGHT, true);
        S(4, 3, TOWN); S(4, 4, TOWN); S(4, 5, TOWN); S(4, 6, TOWN);
        S(4, 7, ROAD, RIGHT, true);
        // Row 5 — Gated Highway
        S(5, 0, SPAWN); S(5, 1, HIGHWAY);
        S(5, 2, ROAD, RIGHT, true); S(5, 3, GATE);
        S(5, 4, HIGHWAY); S(5, 5, HIGHWAY);
        S(5, 6, GATE); S(5, 7, ROAD, RIGHT, true);
        S(5, 8, HIGHWAY); S(5, 9, EXIT);
        // Row 6 — Connectors
        for (let c = 1; c <= 8; c++) S(6, c, ROAD, RIGHT, true);
        // Row 7 — Bottom Highway (gated)
        S(7, 0, SPAWN); S(7, 1, HIGHWAY);
        S(7, 2, ROAD, RIGHT, true); S(7, 3, GATE);
        S(7, 4, HIGHWAY); S(7, 5, HIGHWAY);
        S(7, 6, GATE); S(7, 7, ROAD, RIGHT, true);
        S(7, 8, HIGHWAY); S(7, 9, EXIT);
    }

    // ==================== EVENTS ====================
    bindEvents() {
        this.cvs.addEventListener('click', (e) => {
            if (this.paused || this.over || !this.running) return;
            this.sfx.init();
            const rect = this.cvs.getBoundingClientRect();
            const col = Math.floor((e.clientX - rect.left) * (W / rect.width) / TILE);
            const row = Math.floor((e.clientY - rect.top) * (H / rect.height) / TILE);
            if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
            const cell = this.grid[row][col];
            if (cell.kind === GATE) {
                cell.gateOpen = !cell.gateOpen;
                cell.flashTimer = 12;
                this.sfx.gate();
            } else if (cell.rotatable) {
                cell.dir = (cell.dir + 1) % 4;
                cell.flashTimer = 12;
                this.sfx.rotate();
            }
        });

        this.cvs.addEventListener('mousemove', (e) => {
            const rect = this.cvs.getBoundingClientRect();
            const col = Math.floor((e.clientX - rect.left) * (W / rect.width) / TILE);
            const row = Math.floor((e.clientY - rect.top) * (H / rect.height) / TILE);
            if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
                const cell = this.grid[row][col];
                const interactive = cell.rotatable || cell.kind === GATE;
                this.cvs.style.cursor = interactive ? 'pointer' : 'default';
                this.hoverRow = interactive ? row : -1;
                this.hoverCol = interactive ? col : -1;
            } else {
                this.hoverRow = -1;
                this.hoverCol = -1;
            }
        });

        this.cvs.addEventListener('mouseleave', () => {
            this.hoverRow = -1;
            this.hoverCol = -1;
        });

        // Start
        document.getElementById('start-btn').addEventListener('click', () => {
            this.sfx.init();
            document.getElementById('tutorial-overlay').classList.add('hidden');
            this.running = true;
            this.last = performance.now();
            requestAnimationFrame(() => this.loop());
        });

        // Pause / Restart
        document.getElementById('pause-btn').addEventListener('click', () => {
            if (!this.running || this.over) return;
            this.paused = !this.paused;
            document.getElementById('pause-btn').textContent = this.paused ? 'RESUME' : 'PAUSE';
            if (!this.paused) {
                this.last = performance.now();
                requestAnimationFrame(() => this.loop());
            }
        });
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
        document.getElementById('result-restart-btn').addEventListener('click', () => this.restart());

        // Power-up buttons
        document.getElementById('power-slow').addEventListener('click', () => this.usePower('slow'));
        document.getElementById('power-clear').addEventListener('click', () => this.usePower('clear'));
        document.getElementById('power-boost').addEventListener('click', () => this.usePower('boost'));

        // Keyboard shortcuts for power-ups
        document.addEventListener('keydown', (e) => {
            if (!this.running || this.paused || this.over) return;
            if (e.key === 'q' || e.key === 'Q') this.usePower('slow');
            if (e.key === 'w' || e.key === 'W') this.usePower('clear');
            if (e.key === 'e' || e.key === 'E') this.usePower('boost');
        });
    }

    // ==================== POWER-UPS ====================
    usePower(type) {
        if (this.powers[type] <= 0) return;
        this.sfx.init();
        this.sfx.powerup();
        this.powers[type]--;

        if (type === 'slow') {
            this.slowActive = 300; // 5 seconds at 60fps
            this.cars.forEach(car => { car.speed = car.baseSpeed * 0.4; });
        } else if (type === 'clear') {
            // Remove all cars safely
            for (let i = this.cars.length - 1; i >= 0; i--) {
                this.particles(this.cars[i].x, this.cars[i].y, '#6688ff');
                this.cars[i].alive = false;
            }
            this.cars = [];
        } else if (type === 'boost') {
            this.economy = Math.min(100, this.economy + 15);
            this.score += 10;
        }

        this.updatePowerUI();
    }

    updatePowerUI() {
        const ids = ['slow', 'clear', 'boost'];
        ids.forEach(id => {
            const btn = document.getElementById('power-' + id);
            const count = document.getElementById('power-' + id + '-count');
            count.textContent = this.powers[id];
            if (this.powers[id] <= 0) btn.classList.add('used');
            else btn.classList.remove('used');
        });
        // Show active state for slow
        const slowBtn = document.getElementById('power-slow');
        if (this.slowActive > 0) slowBtn.classList.add('active');
        else slowBtn.classList.remove('active');
    }

    // ==================== WEATHER SYSTEM ====================
    updateWeather() {
        this.weatherTimer++;
        if (this.weatherTimer >= this.nextWeatherChange) {
            this.weatherTimer = 0;
            this.nextWeatherChange = 900 + Math.floor(Math.random() * 900);

            // Pick new weather (weighted toward clear)
            const roll = Math.random();
            if (roll < 0.4) this.weather = WEATHER_CLEAR;
            else if (roll < 0.6) this.weather = WEATHER_SANDSTORM;
            else if (roll < 0.8) this.weather = WEATHER_NIGHT;
            else this.weather = WEATHER_RAIN;

            this.applyWeather();
        }
    }

    applyWeather() {
        // Clear all weather classes
        this.eWeatherOverlay.className = '';

        switch (this.weather) {
            case WEATHER_SANDSTORM:
                this.eWeatherOverlay.className = 'sandstorm';
                // Cars slightly faster (wind push)
                break;
            case WEATHER_NIGHT:
                this.eWeatherOverlay.className = 'night';
                break;
            case WEATHER_RAIN:
                this.eWeatherOverlay.className = 'rain';
                break;
            default:
                break;
        }

        this.eWeatherIcon.innerHTML = WEATHER_ICONS[this.weather];
        this.eWeatherText.textContent = WEATHER_NAMES[this.weather];
    }

    getWeatherSpeedModifier() {
        if (this.weather === WEATHER_RAIN) return 0.7;
        if (this.weather === WEATHER_SANDSTORM) return 1.15;
        return 1.0;
    }

    // ==================== RESTART ====================
    restart() {
        this.cars = [];
        this.economy = START_ECONOMY;
        this.score = 0;
        this.totalCars = 0;
        this.redirected = 0;
        this.bypassed = 0;
        this.timeLeft = GAME_TIME;
        this.over = false;
        this.paused = false;
        this.frame = 0;
        this.combo = 1;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.weather = WEATHER_CLEAR;
        this.weatherTimer = 0;
        this.nextWeatherChange = 900 + Math.floor(Math.random() * 600);
        this.powers = { slow: 3, clear: 2, boost: 2 };
        this.slowActive = 0;
        this.townTier = 1;

        // Reset level
        this.level = 1;
        this.levelRedirected = 0;
        this.levelConfig = LEVELS[0];
        this.spawnRate = this.levelConfig.spawnRate;
        this.spawnCD = 0;
        this.diffTimer = 0;
        this.shuffleTimer = 0;
        this.gateToggleTimer = 0;

        this.applyWeather();
        this.updatePowerUI();
        document.getElementById('result-overlay').classList.add('hidden');
        document.getElementById('pause-btn').textContent = 'PAUSE';
        this.buildMap();
        this.refreshUI();
        this.running = true;
        this.last = performance.now();
        requestAnimationFrame(() => this.loop());
    }

    // ==================== MAIN LOOP ====================
    loop() {
        if (this.paused || this.over) return;
        this.frame++;

        // Timer
        if (this.frame % 60 === 0) {
            this.timeLeft = Math.max(0, this.timeLeft - 1);
            if (this.timeLeft <= 0) {
                // Time up = lose if not all levels done
                this.endGame(this.level > MAX_LEVEL);
                return;
            }
        }

        // Difficulty ramp within level
        this.diffTimer++;
        if (this.diffTimer % 600 === 0 && this.spawnRate > this.minSpawnRate) {
            this.spawnRate = Math.max(this.minSpawnRate, this.spawnRate - 5);
            this.updateDiff();
        }

        // Weather
        this.updateWeather();

        // === ROAD SHUFFLE (the key anti-set-and-forget mechanic) ===
        const shuffleInterval = this.levelConfig.shuffleEvery;
        if (shuffleInterval > 0) {
            this.shuffleTimer++;
            if (this.shuffleTimer >= shuffleInterval) {
                this.shuffleTimer = 0;
                this.shuffleRoads();
            }
        }

        // === GATE AUTO-TOGGLE ===
        const gateInterval = this.levelConfig.gateToggle;
        if (gateInterval > 0) {
            this.gateToggleTimer++;
            if (this.gateToggleTimer >= gateInterval) {
                this.gateToggleTimer = 0;
                this.autoToggleGates();
            }
        }

        // Slow power-up countdown
        if (this.slowActive > 0) {
            this.slowActive--;
            if (this.slowActive === 0) {
                this.cars.forEach(car => {
                    car.speed = car.baseSpeed * this.getWeatherSpeedModifier();
                });
                this.updatePowerUI();
            }
        }

        // Combo decay
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer === 0) {
                this.combo = 1; this.comboCount = 0;
            }
        }

        // Town tier update
        if (this.economy >= 80) this.townTier = 2;
        else if (this.economy >= 40) this.townTier = 1;
        else this.townTier = 0;

        // Spawn (respect max cars on screen)
        this.spawnCD++;
        const aliveCars = this.cars.filter(c => c.alive).length;
        if (this.spawnCD >= this.spawnRate && aliveCars < this.levelConfig.maxCars) {
            this.spawnCar();
            this.spawnCD = 0;
        }

        // Update
        this.updateCars();
        if (this.over) return;

        // Level-up check
        if (this.levelRedirected >= this.levelConfig.target && this.level <= MAX_LEVEL) {
            this.levelUp();
        }

        // Render
        this.draw();
        if (this.frame % 8 === 0) {
            this.refreshUI();
            this.updateDiff();
        }

        requestAnimationFrame(() => this.loop());
    }

    // ==================== SPAWN ====================
    spawnCar() {
        const spawns = [];
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                if (this.grid[r][c].kind === SPAWN) spawns.push({ r, c });
        if (!spawns.length) return;

        const weighted = [];
        for (const s of spawns) {
            const w = (s.r === 2 || s.r === 5) ? 2 : 1;
            for (let i = 0; i < w; i++) weighted.push(s);
        }
        const pick = weighted[Math.floor(Math.random() * weighted.length)];

        if (this.cars.some(car => car.alive && car.gRow === pick.r &&
            Math.abs(car.x - (pick.c * TILE + TILE / 2)) < TILE * 1.3)) return;

        const char = CAR_CHARACTERS[Math.floor(Math.random() * CAR_CHARACTERS.length)];
        const car = new Car(pick.r, pick.c, char);
        // Apply level speed, weather, and slow power
        car.baseSpeed = car.isTruck ? car.baseSpeed : this.levelConfig.speed;
        const weatherMod = this.getWeatherSpeedModifier();
        car.speed = car.baseSpeed * weatherMod;
        if (this.slowActive > 0) car.speed *= 0.4;

        this.cars.push(car);
        this.totalCars++;
    }

    // ==================== UPDATE CARS ====================
    updateCars() {
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];
            if (!car.alive) { this.cars.splice(i, 1); continue; }

            const dx = car.tx - car.x;
            const dy = car.ty - car.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < car.speed + 0.5) {
                car.x = car.tx; car.y = car.ty;
                car.gCol = Math.round((car.x - TILE / 2) / TILE);
                car.gRow = Math.round((car.y - TILE / 2) / TILE);

                if (car.gCol < 0 || car.gCol >= COLS || car.gRow < 0 || car.gRow >= ROWS) {
                    this.carExit(car); continue;
                }

                const cell = this.grid[car.gRow][car.gCol];
                if (cell.kind === TOWN) car.touchedTown = true;

                const exitD = cell.exitDir(car.dir);
                if (exitD === -2) { this.carExit(car); continue; }
                if (exitD === -1) { this.carCrash(car); continue; }

                car.dir = exitD;
                const nc = car.gCol + DX[car.dir];
                const nr = car.gRow + DY[car.dir];

                if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) {
                    this.carExit(car); continue;
                }

                const next = this.grid[nr][nc];
                if (next.kind === EMPTY) { this.carCrash(car); continue; }
                if (next.kind === GATE && !next.gateOpen) { this.carCrash(car); continue; }

                car.tx = nc * TILE + TILE / 2;
                car.ty = nr * TILE + TILE / 2;
            } else {
                car.x += (dx / dist) * car.speed;
                car.y += (dy / dist) * car.speed;
            }

            // Collision
            for (let j = i - 1; j >= 0; j--) {
                const o = this.cars[j];
                if (!o.alive) continue;
                if (Math.abs(car.x - o.x) < 14 && Math.abs(car.y - o.y) < 14) {
                    this.carCrash(car);
                    this.carCrash(o);
                    break;
                }
            }
        }
    }

    carExit(car) {
        car.alive = false;
        if (car.touchedTown) {
            // Combo system
            this.comboCount++;
            this.comboTimer = 240; // 4 seconds to keep combo alive
            if (this.comboCount >= 3) {
                this.combo = Math.min(5, 1 + Math.floor(this.comboCount / 3));
                if (this.comboCount % 3 === 0) {
                    this.sfx.combo();
                    this.showComboPopup();
                }
            }

            const points = (car.isTruck ? 30 : 15) * this.combo;
            this.redirected++;
            this.levelRedirected++;
            this.score += points;
            this.economy = Math.min(100, this.economy + (car.isTruck ? 5 : 3));
            this.sfx.redirect();
            // Floating score popup
            const txt = this.combo > 1 ? `+${points} x${this.combo}!` : `+${points}`;
            this.floatingTexts.push({
                x: car.x, y: car.y,
                text: txt,
                color: this.combo > 1 ? '#f0d040' : '#68e088',
                life: 60, maxLife: 60
            });
        } else {
            this.bypassed++;
            this.economy = Math.max(0, this.economy - 2);
            // Reset combo on bypass
            this.combo = 1; this.comboCount = 0; this.comboTimer = 0;
            if (this.economy <= 0) this.endGame(false);
        }
    }

    carCrash(car) {
        if (!car.alive) return;
        car.alive = false;
        this.economy = Math.max(0, this.economy - 4);
        this.score = Math.max(0, this.score - 3);
        this.sfx.crash();
        this.particles(car.x, car.y, car.color);
        this.triggerShake();
        // Floating crash text
        this.floatingTexts.push({
            x: car.x, y: car.y,
            text: 'CRASH!',
            color: '#ff5050',
            life: 45, maxLife: 45
        });
        // Reset combo on crash
        this.combo = 1; this.comboCount = 0; this.comboTimer = 0;
        if (this.economy <= 0) this.endGame(false);
    }

    // ==================== SCREEN SHAKE ====================
    triggerShake() {
        if (this.shaking) return;
        this.shaking = true;
        this.eStage.classList.add('shake');
        setTimeout(() => {
            this.eStage.classList.remove('shake');
            this.shaking = false;
        }, 400);
    }

    // ==================== COMBO POPUP ====================
    showComboPopup() {
        this.eComboPopup.textContent = `x${this.combo} COMBO!`;
        this.eComboPopup.classList.remove('hidden');
        // Reset animation
        this.eComboPopup.style.animation = 'none';
        void this.eComboPopup.offsetHeight;
        this.eComboPopup.style.animation = '';
        setTimeout(() => this.eComboPopup.classList.add('hidden'), 1000);
    }

    // ==================== LEVEL SYSTEM ====================
    levelUp() {
        this.level++;
        this.levelRedirected = 0;

        if (this.level > MAX_LEVEL) {
            // Beat all levels — win!
            this.endGame(true);
            return;
        }

        this.levelConfig = LEVELS[this.level - 1];
        this.spawnRate = this.levelConfig.spawnRate;
        this.shuffleTimer = 0;
        this.gateToggleTimer = 0;

        // Bonus: give a power-up refill on level up
        this.powers.slow = Math.min(this.powers.slow + 1, 5);
        this.powers.clear = Math.min(this.powers.clear + 1, 4);
        this.powers.boost = Math.min(this.powers.boost + 1, 3);
        this.updatePowerUI();

        // Small economy & score bonus
        this.economy = Math.min(100, this.economy + 10);
        this.score += 50 * this.level;

        // Shuffle roads on level up to force re-adjustment
        this.shuffleRoads();

        // Show level banner
        this.showLevelBanner();
        this.sfx.combo();

        this.refreshUI();
    }

    showLevelBanner() {
        const warnings = [
            '',
            'Route 66 gets busy!',
            'Gates auto-toggle!',
            'Radiator Springs needs you!',
            'PISTON CUP FINALE!'
        ];
        const sub = this.level <= MAX_LEVEL ? warnings[this.level - 1] : 'KA-CHOW! YOU WIN!';
        this.eLevelBanner.innerHTML = `\ud83c\udfc1 LEVEL ${this.level}<span class="level-sub">${sub}</span>`;
        this.eLevelBanner.classList.remove('hidden');
        this.eLevelBanner.style.animation = 'none';
        void this.eLevelBanner.offsetHeight;
        this.eLevelBanner.style.animation = '';
        setTimeout(() => this.eLevelBanner.classList.add('hidden'), 1800);
    }

    // ==================== ROAD SHUFFLE ====================
    shuffleRoads() {
        // Randomly re-orient all rotatable roads — forces player to re-think
        const rotatables = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (this.grid[r][c].rotatable) rotatables.push(this.grid[r][c]);
            }
        }

        // Shuffle a subset based on level (more shuffled = harder)
        const shuffleCount = Math.min(rotatables.length,
            Math.floor(rotatables.length * (0.3 + this.level * 0.12)));

        // Pick random cells to shuffle
        const toShuffle = [...rotatables].sort(() => Math.random() - 0.5).slice(0, shuffleCount);
        for (const cell of toShuffle) {
            cell.dir = Math.floor(Math.random() * 4);
            cell.flashTimer = 20;
        }

        // Show warning
        this.eShuffleWarn.classList.remove('hidden');
        this.eShuffleWarn.style.animation = 'none';
        void this.eShuffleWarn.offsetHeight;
        this.eShuffleWarn.style.animation = '';
        setTimeout(() => this.eShuffleWarn.classList.add('hidden'), 1800);

        this.sfx.gate();
    }

    // ==================== GATE AUTO-TOGGLE ====================
    autoToggleGates() {
        // Randomly toggle 1-2 gates
        const gates = [];
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                if (this.grid[r][c].kind === GATE) gates.push(this.grid[r][c]);

        const count = Math.min(gates.length, 1 + Math.floor(Math.random() * 2));
        const toToggle = [...gates].sort(() => Math.random() - 0.5).slice(0, count);
        for (const gate of toToggle) {
            gate.gateOpen = !gate.gateOpen;
            gate.flashTimer = 15;
        }
        this.sfx.gate();
    }

    // ==================== PARTICLES ====================
    particles(cx, cy, color) {
        const rect = this.cvs.getBoundingClientRect();
        const sx = rect.left + cx * (rect.width / W);
        const sy = rect.top + cy * (rect.height / H);
        for (let i = 0; i < 12; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const ang = (Math.PI * 2 / 12) * i + Math.random() * 0.5;
            const d = 20 + Math.random() * 45;
            p.style.left = sx + 'px';
            p.style.top = sy + 'px';
            p.style.background = color;
            p.style.setProperty('--dx', (Math.cos(ang) * d) + 'px');
            p.style.setProperty('--dy', (Math.sin(ang) * d) + 'px');
            this.ePart.appendChild(p);
            setTimeout(() => p.remove(), 700);
        }
    }

    // ==================== END GAME ====================
    endGame(won) {
        this.over = true;
        if (this.score > this.hiScore) {
            this.hiScore = this.score;
            localStorage.setItem('hhHiScore', this.hiScore);
        }
        won ? this.sfx.win() : this.sfx.lose();

        const overlay = document.getElementById('result-overlay');
        const title = document.getElementById('result-title');
        const stats = document.getElementById('result-stats');
        overlay.classList.remove('hidden');

        if (won && this.level > MAX_LEVEL) {
            title.textContent = '\ud83c\udfc6 KA-CHOW! RADIATOR SPRINGS SAVED!';
        } else if (won) {
            title.textContent = '\ud83c\udfc1 RADIATOR SPRINGS THRIVES!';
        } else {
            title.textContent = '\ud83d\udea7 RADIATOR SPRINGS FADED...';
        }
        title.className = won ? 'win' : 'lose';

        const pct = this.totalCars > 0 ? Math.round(this.redirected / this.totalCars * 100) : 0;
        const bestCombo = this.combo;
        stats.innerHTML = `
            <div class="stat-line"><span>Score</span><span>${this.score}</span></div>
            <div class="stat-line"><span>Level Reached</span><span>${Math.min(this.level, MAX_LEVEL)} / ${MAX_LEVEL}</span></div>
            <div class="stat-line"><span>Cars Redirected</span><span>${this.redirected}</span></div>
            <div class="stat-line"><span>Cars Bypassed</span><span>${this.bypassed}</span></div>
            <div class="stat-line"><span>Redirect Rate</span><span>${pct}%</span></div>
            <div class="stat-line"><span>Best Combo</span><span>x${bestCombo}</span></div>
            <div class="stat-line"><span>High Score</span><span>${this.hiScore}</span></div>
            <div class="stat-line"><span>Time Survived</span><span>${GAME_TIME - this.timeLeft}s / ${GAME_TIME}s</span></div>
        `;
        this.refreshUI();
        this.draw();
    }

    // ==================== UI ====================
    refreshUI() {
        const e = Math.max(0, Math.min(100, Math.round(this.economy)));
        this.eFill.style.width = e + '%';
        this.eVal.textContent = e;

        if (e > 50) this.eFill.style.background = '#4a8a40';
        else if (e > 25) this.eFill.style.background = '#b89030';
        else this.eFill.style.background = '#b84040';

        const pct = this.totalCars > 0 ? Math.round(this.redirected / this.totalCars * 100) : 0;
        this.ePct.textContent = pct + '%';
        this.ePct.style.color = pct >= 60 ? '#4a9a58' : (pct >= 30 ? '#b89030' : '#b84040');

        this.eScore.textContent = this.score;
        this.eHi.textContent = this.hiScore;
        this.eCombo.textContent = 'x' + this.combo;
        this.eCombo.style.color = this.combo > 1 ? '#d4a030' : '#887060';

        // Level display
        this.eLevel.textContent = Math.min(this.level, MAX_LEVEL);

        const mins = Math.floor(this.timeLeft / 60);
        const secs = this.timeLeft % 60;
        this.eTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        this.eTime.style.color = this.timeLeft <= 30 ? '#b84040' : '#5a90b0';
    }

    updateDiff() {
        const t = this.eDiff;
        const lvl = this.level;
        const target = this.level <= MAX_LEVEL ? this.levelConfig.target : 0;
        const progress = this.levelRedirected;
        if (lvl <= 2) {
            t.textContent = `LV${lvl} ${progress}/${target}`;
            t.className = 'difficulty-tag';
        } else if (lvl <= 3) {
            t.textContent = `LV${lvl} ${progress}/${target}`;
            t.className = 'difficulty-tag medium';
        } else {
            t.textContent = `LV${lvl} ${progress}/${target}`;
            t.className = 'difficulty-tag hard';
        }
    }

    // ==================== RENDERING ====================
    draw() {
        const c = this.c;
        c.clearRect(0, 0, W, H);

        // Desert background — warm sand tones
        const isNight = this.weather === WEATHER_NIGHT;
        if (isNight) {
            c.fillStyle = '#120a06';
        } else {
            const bgGrad = c.createLinearGradient(0, 0, 0, H);
            bgGrad.addColorStop(0, '#3a2818');
            bgGrad.addColorStop(0.3, '#2e1e10');
            bgGrad.addColorStop(1, '#2a1a0c');
            c.fillStyle = bgGrad;
        }
        c.fillRect(0, 0, W, H);

        // Desert sunset glow at top
        if (!isNight) {
            const skyGlow = c.createLinearGradient(0, 0, 0, 100);
            skyGlow.addColorStop(0, 'rgba(232, 135, 60, 0.08)');
            skyGlow.addColorStop(1, 'rgba(232, 135, 60, 0)');
            c.fillStyle = skyGlow;
            c.fillRect(0, 0, W, 100);
        }

        // Warm neon glow near Radiator Springs (town area)
        const glowStrength = 0.08 + (this.townTier * 0.05);
        const tcx = 4.5 * TILE, tcy = 3.5 * TILE;
        const glow = c.createRadialGradient(tcx, tcy, 10, tcx, tcy, TILE * 3.2);
        glow.addColorStop(0, `rgba(210, 155, 60, ${glowStrength})`);
        glow.addColorStop(1, 'rgba(210, 155, 60, 0)');
        c.fillStyle = glow;
        c.fillRect(0, 0, W, H);

        // Draw cells
        for (let r = 0; r < ROWS; r++)
            for (let cl = 0; cl < COLS; cl++)
                this.drawCell(c, this.grid[r][cl]);

        // Hover glow on interactive tiles
        if (this.hoverRow >= 0 && this.hoverCol >= 0) {
            const hx = this.hoverCol * TILE, hy = this.hoverRow * TILE;
            c.fillStyle = 'rgba(230, 190, 60, 0.12)';
            c.fillRect(hx, hy, TILE, TILE);
            c.strokeStyle = 'rgba(230, 190, 60, 0.5)';
            c.lineWidth = 2;
            c.strokeRect(hx + 1, hy + 1, TILE - 2, TILE - 2);
        }

        // Subtle grid — desert dusty lines
        c.strokeStyle = 'rgba(200, 160, 80, 0.05)';
        c.lineWidth = 1;
        for (let r = 0; r <= ROWS; r++) {
            c.beginPath(); c.moveTo(0, r * TILE); c.lineTo(W, r * TILE); c.stroke();
        }
        for (let cl = 0; cl <= COLS; cl++) {
            c.beginPath(); c.moveTo(cl * TILE, 0); c.lineTo(cl * TILE, H); c.stroke();
        }

        // === RADIATOR SPRINGS WELCOME SIGN (Route 66 Style) ===
        // Draw a small "Welcome" sign near the town entrance
        const signX = 3 * TILE + 6;
        const signY = 2 * TILE - 8;
        // Sign post
        c.fillStyle = 'rgba(100, 70, 35, 0.5)';
        c.fillRect(signX + 18, signY + 10, 2, 14);
        // Sign board
        c.fillStyle = 'rgba(40, 25, 10, 0.7)';
        c.beginPath(); c.roundRect(signX, signY, 38, 12, 2); c.fill();
        c.strokeStyle = 'rgba(220, 180, 60, 0.4)';
        c.lineWidth = 0.5;
        c.beginPath(); c.roundRect(signX, signY, 38, 12, 2); c.stroke();
        // Sign text
        c.fillStyle = 'rgba(72, 216, 176, 0.7)';
        c.font = 'bold 5px Arial';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('WELCOME TO', signX + 19, signY + 4);
        c.fillStyle = 'rgba(232, 168, 76, 0.8)';
        c.font = 'bold 5px Arial';
        c.fillText('R. SPRINGS', signX + 19, signY + 9);

        // Draw cars with isometric depth sorting (bottom first)
        const sortedCars = this.cars.filter(c => c.alive).sort((a, b) => a.y - b.y);
        for (const car of sortedCars) this.drawCar(c, car);

        // Night headlight effect
        if (isNight) {
            for (const car of sortedCars) {
                const hx = car.x + DX[car.dir] * 18;
                const hy = car.y + DY[car.dir] * 18;
                const headlight = c.createRadialGradient(hx, hy, 0, hx, hy, 28);
                headlight.addColorStop(0, 'rgba(255, 240, 180, 0.18)');
                headlight.addColorStop(1, 'rgba(255, 240, 180, 0)');
                c.fillStyle = headlight;
                c.beginPath(); c.arc(hx, hy, 34, 0, 6.28); c.fill();
            }
        }

        // Sandstorm grain (canvas layer)
        if (this.weather === WEATHER_SANDSTORM) {
            c.fillStyle = `rgba(160, 120, 50, ${0.02 + Math.sin(this.frame * 0.05) * 0.01})`;
            c.fillRect(0, 0, W, H);
        }

        // Level progress bar at bottom
        if (this.level <= MAX_LEVEL) {
            const barW = W - 40;
            const barH = 6;
            const barX = 20;
            const barY = H - 14;
            const progress = Math.min(1, this.levelRedirected / this.levelConfig.target);

            // Background
            c.fillStyle = 'rgba(0, 0, 0, 0.4)';
            c.beginPath(); c.roundRect(barX, barY, barW, barH, 3); c.fill();

            // Fill — racing flag gradual fill
            const barGrad = c.createLinearGradient(barX, barY, barX + barW * progress, barY);
            barGrad.addColorStop(0, '#d44020');
            barGrad.addColorStop(0.5, '#e88040');
            barGrad.addColorStop(1, '#f0c040');
            c.fillStyle = barGrad;
            c.beginPath(); c.roundRect(barX, barY, barW * progress, barH, 3); c.fill();

            // Label
            c.fillStyle = 'rgba(255, 240, 200, 0.6)';
            c.font = 'bold 8px Segoe UI, Arial';
            c.textAlign = 'left'; c.textBaseline = 'bottom';
            c.fillText(`LV${this.level}: ${this.levelRedirected}/${this.levelConfig.target}`, barX + 2, barY - 2);

            // Next level hint
            if (progress > 0.5) {
                c.textAlign = 'right';
                c.fillText(`NEXT: LV${this.level + 1}`, barX + barW - 2, barY - 2);
            }
        }

        // === FLOATING SCORE TEXTS ===
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.life--;
            if (ft.life <= 0) { this.floatingTexts.splice(i, 1); continue; }
            const progress = 1 - ft.life / ft.maxLife;
            const alpha = 1 - progress * progress; // fade out
            const yOff = progress * 30; // float upward
            c.save();
            c.globalAlpha = alpha;
            c.fillStyle = ft.color;
            c.font = 'bold 14px Segoe UI, Arial';
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(ft.text, ft.x, ft.y - yOff);
            c.restore();
        }

        // === LOW TIME WARNING (red vignette when < 30s) ===
        if (this.timeLeft <= 30 && this.running && !this.over) {
            const pulse = 0.08 + Math.sin(this.frame * 0.12) * 0.04;
            // Top edge
            const topGrad = c.createLinearGradient(0, 0, 0, 60);
            topGrad.addColorStop(0, `rgba(200, 30, 30, ${pulse})`);
            topGrad.addColorStop(1, 'rgba(200, 30, 30, 0)');
            c.fillStyle = topGrad;
            c.fillRect(0, 0, W, 60);
            // Bottom edge
            const botGrad = c.createLinearGradient(0, H, 0, H - 60);
            botGrad.addColorStop(0, `rgba(200, 30, 30, ${pulse})`);
            botGrad.addColorStop(1, 'rgba(200, 30, 30, 0)');
            c.fillStyle = botGrad;
            c.fillRect(0, H - 60, W, 60);
            // Side edges
            const leftGrad = c.createLinearGradient(0, 0, 40, 0);
            leftGrad.addColorStop(0, `rgba(200, 30, 30, ${pulse * 0.7})`);
            leftGrad.addColorStop(1, 'rgba(200, 30, 30, 0)');
            c.fillStyle = leftGrad;
            c.fillRect(0, 0, 40, H);
            const rightGrad = c.createLinearGradient(W, 0, W - 40, 0);
            rightGrad.addColorStop(0, `rgba(200, 30, 30, ${pulse * 0.7})`);
            rightGrad.addColorStop(1, 'rgba(200, 30, 30, 0)');
            c.fillStyle = rightGrad;
            c.fillRect(W - 40, 0, 40, H);
        }
    }

    drawCell(c, cell) {
        const x = cell.col * TILE, y = cell.row * TILE;
        const cx = x + TILE / 2, cy = y + TILE / 2;
        if (cell.flashTimer > 0) cell.flashTimer--;

        switch (cell.kind) {
            case EMPTY:    this._drawEmpty(c, x, y); break;
            case HIGHWAY:
            case SPAWN:
            case EXIT:     this._drawHighway(c, x, y, cx, cy, cell.kind); break;
            case ROAD:     this._drawRoad(c, x, y, cx, cy, cell); break;
            case TOWN:     this._drawTown(c, x, y, cx, cy, cell); break;
            case GATE:     this._drawGate(c, x, y, cx, cy, cell); break;
        }
    }

    _drawEmpty(c, x, y) {
        // Desert sand ground
        const v = ((x * 7 + y * 13) % 20) / 1000;
        const sandGrad = c.createLinearGradient(x, y, x, y + TILE);
        sandGrad.addColorStop(0, `rgba(180, 140, 80, ${0.12 + v})`);
        sandGrad.addColorStop(1, `rgba(160, 120, 60, ${0.10 + v})`);
        c.fillStyle = sandGrad;
        c.fillRect(x, y, TILE, TILE);

        // Sand texture dots
        c.fillStyle = 'rgba(200, 160, 80, 0.08)';
        c.fillRect(x + 12, y + 18, 2, 2);
        c.fillRect(x + 48, y + 35, 2, 2);
        c.fillRect(x + 30, y + 55, 1, 1);
        c.fillRect(x + 55, y + 12, 1, 1);

        // Small cacti and rocks on some tiles (deterministic from position)
        const hash = (x * 31 + y * 17) % 100;
        if (hash < 20) {
            // Small cactus
            c.fillStyle = 'rgba(80, 120, 50, 0.3)';
            const cx = x + 20 + (hash % 30);
            const cy2 = y + 45 + (hash % 15);
            c.fillRect(cx, cy2 - 12, 3, 12);
            c.fillRect(cx - 4, cy2 - 8, 3, 5);
            c.fillRect(cx + 4, cy2 - 6, 3, 4);
        } else if (hash < 35) {
            // Small rock
            c.fillStyle = 'rgba(120, 90, 50, 0.18)';
            c.beginPath();
            c.arc(x + 35 + (hash % 20), y + 50, 3 + (hash % 3), 0, Math.PI * 2);
            c.fill();
        }
    }

    _drawHighway(c, x, y, cx, cy, kind) {
        // Asphalt base — warm desert asphalt
        c.fillStyle = '#2a2018';
        c.fillRect(x, y, TILE, TILE);

        // Road surface with hot asphalt gradient
        const roadGrad = c.createLinearGradient(x, cy - 15, x, cy + 15);
        roadGrad.addColorStop(0, '#504840');
        roadGrad.addColorStop(0.4, '#403830');
        roadGrad.addColorStop(1, '#383028');
        c.fillStyle = roadGrad;
        c.fillRect(x + 1, cy - 15, TILE - 2, 30);

        // Edge lines — faded yellow (Route 66 style)
        c.strokeStyle = 'rgba(220, 180, 60, 0.25)';
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x, cy - 15); c.lineTo(x + TILE, cy - 15); c.stroke();
        c.beginPath(); c.moveTo(x, cy + 15); c.lineTo(x + TILE, cy + 15); c.stroke();

        // Center dashes — white
        c.strokeStyle = 'rgba(255, 255, 240, 0.25)';
        c.lineWidth = 1;
        c.setLineDash([7, 9]);
        c.beginPath(); c.moveTo(x + 4, cy); c.lineTo(x + TILE - 4, cy); c.stroke();
        c.setLineDash([]);

        // Route 66 '66' shield on some highway tiles
        const hHash = (x * 3 + y * 7) % 100;
        if (hHash < 15 && kind === HIGHWAY) {
            c.fillStyle = 'rgba(255, 255, 240, 0.12)';
            c.font = 'bold 8px Arial';
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText('66', cx, cy - 20);
        }

        if (kind === SPAWN) {
            c.fillStyle = '#e88040';
            c.font = 'bold 15px Arial';
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText('\u25b6', cx, cy);
        }
        if (kind === EXIT) {
            c.fillStyle = '#c8d070';
            c.font = 'bold 12px Arial';
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText('EXIT', cx, cy);
        }
    }

    _drawRoad(c, x, y, cx, cy, cell) {
        const flash = cell.flashTimer > 0;
        c.fillStyle = flash ? 'rgba(120, 100, 50, 0.4)' : 'rgba(50, 38, 24, 0.5)';
        c.fillRect(x, y, TILE, TILE);

        const dir = cell.dir;
        const pad = 8;

        // Road surface — dusty desert road
        if (dir === RIGHT || dir === LEFT) {
            const rg = c.createLinearGradient(x, cy - 12, x, cy + 12);
            rg.addColorStop(0, '#504838');
            rg.addColorStop(1, '#403428');
            c.fillStyle = rg;
            c.fillRect(x + pad, cy - 12, TILE - pad * 2, 24);
            c.strokeStyle = 'rgba(220, 180, 80, 0.15)';
            c.lineWidth = 1;
            c.setLineDash([4, 6]);
            c.beginPath(); c.moveTo(x + pad, cy); c.lineTo(x + TILE - pad, cy); c.stroke();
            c.setLineDash([]);
        } else {
            const rg = c.createLinearGradient(cx - 12, y, cx + 12, y);
            rg.addColorStop(0, '#504838');
            rg.addColorStop(1, '#403428');
            c.fillStyle = rg;
            c.fillRect(cx - 12, y + pad, 24, TILE - pad * 2);
            c.strokeStyle = 'rgba(220, 180, 80, 0.15)';
            c.lineWidth = 1;
            c.setLineDash([4, 6]);
            c.beginPath(); c.moveTo(cx, y + pad); c.lineTo(cx, y + TILE - pad); c.stroke();
            c.setLineDash([]);
        }

        // Direction arrow
        c.save();
        c.translate(cx, cy);
        c.rotate(DIR_ANGLES[dir]);
        c.fillStyle = cell.rotatable ? 'rgba(230, 190, 70, 0.9)' : 'rgba(160, 165, 175, 0.5)';
        c.font = 'bold 22px Arial';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('\u27a4', 0, 0);
        c.restore();

        // Rotatable hint
        if (cell.rotatable) {
            c.fillStyle = 'rgba(220, 160, 55, 0.6)';
            c.font = '11px Arial';
            c.textAlign = 'left'; c.textBaseline = 'top';
            c.fillText('\u21bb', x + 3, y + 2);

            c.strokeStyle = 'rgba(220, 160, 55, 0.2)';
            c.lineWidth = 1;
            c.setLineDash([3, 4]);
            c.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
            c.setLineDash([]);
        }
    }

    _drawTown(c, x, y, cx, cy, cell) {
        const tier = this.townTier;

        // Radiator Springs — warm desert town ambience
        const baseBright = [0.20, 0.30, 0.42][tier];
        const pulse = Math.sin(this.frame * 0.025) * 0.03 + baseBright;
        c.fillStyle = `rgba(180, 120, 50, ${pulse})`;
        c.fillRect(x, y, TILE, TILE);

        // Sandy ground texture
        c.fillStyle = 'rgba(200, 160, 80, 0.06)';
        c.fillRect(x + 5, y + 40, TILE - 10, TILE - 42);

        // Buildings — Radiator Springs style (adobe/southwestern)
        const bColors = [
            ['rgba(160, 90, 50, 0.5)', 'rgba(120, 80, 40, 0.4)'],    // tier 0 — quiet
            ['rgba(190, 110, 55, 0.55)', 'rgba(140, 90, 50, 0.5)'],   // tier 1 — busy
            ['rgba(210, 130, 60, 0.65)', 'rgba(160, 100, 55, 0.6)']   // tier 2 — thriving
        ][tier];

        // Building 1 — Flo's V8 Café style
        const b1h = [20, 26, 32][tier];
        c.fillStyle = bColors[0];
        c.fillRect(x + 8, y + 36 - b1h, 22, b1h);
        // Awning
        c.fillStyle = 'rgba(200, 60, 30, 0.35)';
        c.fillRect(x + 6, y + 36 - b1h - 3, 26, 3);

        // Building 2 — Ramone's style
        const b2h = [14, 20, 26][tier];
        c.fillStyle = bColors[1];
        c.fillRect(x + 38, y + 36 - b2h, 18, b2h);

        // Building 3 — tier 1+ (Sarge's surplus style)
        if (tier >= 1) {
            c.fillStyle = 'rgba(80, 100, 60, 0.4)';
            c.fillRect(x + 14, y + 44, 25, 14);
        }

        // Neon sign glow (stronger at higher tiers)
        if (tier >= 1) {
            const neonPulse = 0.15 + Math.sin(this.frame * 0.06) * 0.08;
            // Neon glow behind buildings
            c.shadowBlur = 8;
            c.shadowColor = `rgba(72, 216, 176, ${neonPulse})`;
            c.fillStyle = `rgba(72, 216, 176, ${neonPulse * 0.5})`;
            c.fillRect(x + 10, y + 36 - b1h - 6, 18, 3);
            c.shadowBlur = 0;
        }
        if (tier === 2) {
            const neonPulse2 = 0.12 + Math.sin(this.frame * 0.04 + 1) * 0.06;
            c.shadowBlur = 6;
            c.shadowColor = `rgba(232, 80, 40, ${neonPulse2})`;
            c.fillStyle = `rgba(232, 80, 40, ${neonPulse2 * 0.5})`;
            c.fillRect(x + 40, y + 36 - b2h - 6, 14, 3);
            c.shadowBlur = 0;
        }

        // Window lights — warm yellow (lit when economy is good)
        const windowBright = [0.4, 0.65, 0.95][tier];
        c.fillStyle = `rgba(255, 220, 120, ${windowBright})`;
        c.fillRect(x + 11, y + 36 - b1h + 4, 3, 3);
        c.fillRect(x + 21, y + 36 - b1h + 4, 3, 3);
        if (b1h > 20) {
            c.fillRect(x + 11, y + 36 - b1h + 12, 3, 3);
            c.fillRect(x + 21, y + 36 - b1h + 12, 3, 3);
        }
        c.fillRect(x + 41, y + 36 - b2h + 4, 3, 3);
        c.fillRect(x + 49, y + 36 - b2h + 4, 3, 3);
        if (tier >= 1) {
            c.fillRect(x + 17, y + 48, 3, 3);
            c.fillRect(x + 28, y + 48, 3, 3);
        }

        // Road intersection — dusty Route 66 spur
        c.fillStyle = 'rgba(60, 45, 25, 0.55)';
        c.fillRect(x, cy - 10, TILE, 20);
        c.fillRect(cx - 10, y, 20, TILE);

        // Border — warm glow
        const borderAlpha = [0.25, 0.38, 0.55][tier];
        c.strokeStyle = `rgba(220, 160, 50, ${borderAlpha})`;
        c.lineWidth = 1;
        c.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);

        // Tier 2 prosperity glow — neon-lit town
        if (tier === 2) {
            const pg = c.createRadialGradient(cx, cy, 5, cx, cy, TILE * 0.65);
            pg.addColorStop(0, 'rgba(72, 216, 176, 0.05)');
            pg.addColorStop(0.5, 'rgba(232, 168, 76, 0.04)');
            pg.addColorStop(1, 'rgba(220, 180, 60, 0)');
            c.fillStyle = pg;
            c.fillRect(x, y, TILE, TILE);
        }

        // Label — "RADIATOR SPRINGS" on center town tile
        if (cell.row === 3 && cell.col === 4) {
            const labels = ['R. SPRINGS', 'RADIATOR\nSPRINGS', '\u2b50 RADIATOR\nSPRINGS'];
            c.fillStyle = `rgba(72, 216, 176, ${0.55 + tier * 0.18})`;
            c.font = 'bold 7px Segoe UI, Arial';
            c.textAlign = 'center'; c.textBaseline = 'middle';
            if (tier >= 1) {
                c.shadowBlur = 4;
                c.shadowColor = 'rgba(72, 216, 176, 0.4)';
            }
            c.fillText(tier < 1 ? 'R. SPRINGS' : 'RADIATOR', cx, y + 5);
            if (tier >= 1) c.fillText('SPRINGS', cx, y + 13);
            c.shadowBlur = 0;
        }
    }

    _drawGate(c, x, y, cx, cy, cell) {
        this._drawHighway(c, x, y, cx, cy, HIGHWAY);

        if (!cell.gateOpen) {
            // Barrier bar
            c.fillStyle = '#a82530';
            c.fillRect(x + 12, cy - 2.5, TILE - 24, 5);
            // Stripes
            c.strokeStyle = '#c08820';
            c.lineWidth = 1.2;
            for (let i = 0; i < 3; i++) {
                c.beginPath();
                c.moveTo(x + 16 + i * 14, cy - 2.5);
                c.lineTo(x + 22 + i * 14, cy + 2.5);
                c.stroke();
            }
            // Indicator dot
            c.fillStyle = '#c03040';
            c.beginPath(); c.arc(cx, cy, 3.5, 0, 6.28); c.fill();
        } else {
            // Open indicator
            c.fillStyle = 'rgba(50, 150, 70, 0.2)';
            c.fillRect(x + 12, cy - 1, TILE - 24, 2);
            c.fillStyle = '#48a058';
            c.beginPath(); c.arc(cx, cy, 2.5, 0, 6.28); c.fill();
        }

        // Label
        c.fillStyle = cell.gateOpen ? '#68a870' : '#b06060';
        c.font = 'bold 7px Segoe UI, Arial';
        c.textAlign = 'center'; c.textBaseline = 'top';
        c.fillText(cell.gateOpen ? 'OPEN' : 'CLOSED', cx, y + 3);

        if (cell.flashTimer > 0) {
            c.strokeStyle = 'rgba(255,255,255,0.15)';
            c.lineWidth = 1;
            c.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        }
    }

    drawCar(c, car) {
        // Blink logic
        car.blinkTimer--;
        if (car.blinkTimer <= 0) {
            car.blinking = 6;
            car.blinkTimer = 80 + Math.floor(Math.random() * 120);
        }
        if (car.blinking > 0) car.blinking--;

        c.save();
        c.translate(car.x, car.y);
        c.rotate(DIR_ANGLES[car.dir]);

        const isTruck = car.isTruck;
        const style = car.bodyStyle;
        const face = car.face;
        const hw = isTruck ? 26 : (style === 'fiat' ? 16 : 20);
        const hh = isTruck ? 15 : (style === 'fiat' ? 11 : 13);
        const clr = car.color;
        const acc = car.accent;

        // ═══════════════════════════════════════
        //  LAYER 0 — GROUND SHADOW (multi-layer)
        // ═══════════════════════════════════════
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.beginPath(); c.ellipse(2, hh + 7, hw + 4, 8, 0, 0, 6.28); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.20)';
        c.beginPath(); c.ellipse(1, hh + 5, hw, 5, 0, 0, 6.28); c.fill();

        // ═══════════════════════════════════════
        //  LAYER 1 — UNDERCARRIAGE (3D depth)
        // ═══════════════════════════════════════
        c.fillStyle = this._darkenColor(clr, 80);
        c.beginPath(); c.roundRect(-hw + 1, -hh + 2, hw * 2 - 2, hh * 2 - 2, 3); c.fill();

        // ═══════════════════════════════════════
        //  LAYER 2 — WHEELS (with rubber + hubcaps)
        // ═══════════════════════════════════════
        const wheelPositions = isTruck
            ? [[-hw + 5, -hh - 1], [-hw + 5, hh + 1], [hw - 7, -hh - 1], [hw - 7, hh + 1]]
            : [[-hw + 5, -hh - 1], [-hw + 5, hh + 1], [hw - 6, -hh - 1], [hw - 6, hh + 1]];
        for (const [wx, wy] of wheelPositions) {
            // Tire
            c.fillStyle = '#1a1a1a';
            c.beginPath(); c.roundRect(wx - 4, wy - 2, 8, 4, 2); c.fill();
            // Tire tread highlight
            c.fillStyle = '#2a2a2a';
            c.beginPath(); c.roundRect(wx - 3, wy - 1.5, 6, 3, 1.5); c.fill();
            // Hubcap
            const hubGrad = c.createRadialGradient(wx, wy, 0, wx, wy, 2.5);
            hubGrad.addColorStop(0, '#e0e0e0');
            hubGrad.addColorStop(0.5, '#a0a0a8');
            hubGrad.addColorStop(1, '#606068');
            c.fillStyle = hubGrad;
            c.beginPath(); c.ellipse(wx, wy, 2, 1.8, 0, 0, 6.28); c.fill();
        }

        // ═══════════════════════════════════════
        //  LAYER 3 — CAR BODY (character-specific)
        // ═══════════════════════════════════════
        const _bodyShape = (cornerRadii) => {
            // Multi-stop gradient for metallic paint
            const bg = c.createLinearGradient(-hw, -hh - 2, -hw, hh + 2);
            bg.addColorStop(0, this._lightenColor(clr, 65));
            bg.addColorStop(0.15, this._lightenColor(clr, 35));
            bg.addColorStop(0.4, clr);
            bg.addColorStop(0.7, this._darkenColor(clr, 30));
            bg.addColorStop(1, this._darkenColor(clr, 65));
            c.fillStyle = bg;
            c.beginPath(); c.roundRect(-hw, -hh, hw * 2, hh * 2, cornerRadii); c.fill();
        };

        if (style === 'truck') {
            // MATER — flat bed + cab
            const bedG = c.createLinearGradient(-hw, -hh, -hw, hh);
            bedG.addColorStop(0, this._lightenColor(clr, 15));
            bedG.addColorStop(0.5, this._darkenColor(clr, 10));
            bedG.addColorStop(1, this._darkenColor(clr, 45));
            c.fillStyle = bedG;
            c.beginPath(); c.roundRect(-hw, -hh + 2, hw * 0.85, hh * 2 - 4, 2); c.fill();
            // Bed planks
            c.strokeStyle = this._darkenColor(clr, 55);
            c.lineWidth = 0.5;
            for (let i = 0; i < 4; i++) {
                const rx = -hw + 4 + i * 5;
                c.beginPath(); c.moveTo(rx, -hh + 4); c.lineTo(rx, hh - 4); c.stroke();
            }
            // Rust patches (layered)
            c.fillStyle = 'rgba(120, 60, 20, 0.25)';
            c.beginPath(); c.ellipse(-hw + 9, -3, 4, 3, 0.3, 0, 6.28); c.fill();
            c.fillStyle = 'rgba(80, 40, 10, 0.3)';
            c.beginPath(); c.ellipse(-hw + 15, 5, 3, 2, -0.2, 0, 6.28); c.fill();
            // Tow hook (metallic)
            const hookG = c.createLinearGradient(-hw - 10, -2, -hw - 10, 10);
            hookG.addColorStop(0, '#888'); hookG.addColorStop(1, '#444');
            c.strokeStyle = hookG; c.lineWidth = 2.5;
            c.beginPath();
            c.moveTo(-hw + 2, 0); c.lineTo(-hw - 7, 0);
            c.arc(-hw - 7, 5, 5, -Math.PI / 2, Math.PI * 0.7);
            c.stroke();
            // Cab (metallic gradient)
            const cabG = c.createLinearGradient(-hw * 0.15, -hh - 2, -hw * 0.15, hh + 2);
            cabG.addColorStop(0, this._lightenColor(clr, 50));
            cabG.addColorStop(0.2, this._lightenColor(clr, 25));
            cabG.addColorStop(0.5, clr);
            cabG.addColorStop(1, this._darkenColor(clr, 50));
            c.fillStyle = cabG;
            c.beginPath(); c.roundRect(-hw * 0.15, -hh, hw * 1.15, hh * 2, 5); c.fill();
        } else if (style === 'van') {
            _bodyShape([4, 8, 8, 4]);
            // Hippie two-tone paint
            c.fillStyle = this._lightenColor(clr, 25);
            c.globalAlpha = 0.25;
            c.beginPath(); c.roundRect(-hw + 1, -hh, hw * 2 - 2, hh, [4, 4, 0, 0]); c.fill();
            c.globalAlpha = 1;
            // Accent stripe
            c.fillStyle = acc;
            c.globalAlpha = 0.4;
            c.beginPath(); c.roundRect(-hw + 3, -1.5, hw * 2 - 6, 3, 1.5); c.fill();
            c.globalAlpha = 1;
            // Peace symbol
            c.strokeStyle = acc; c.lineWidth = 1.2; c.globalAlpha = 0.6;
            c.beginPath(); c.arc(-hw / 2, 0, 5, 0, 6.28); c.stroke();
            c.beginPath(); c.moveTo(-hw / 2, -5); c.lineTo(-hw / 2, 5); c.stroke();
            c.beginPath(); c.moveTo(-hw / 2, 0); c.lineTo(-hw / 2 - 3.5, 3.5); c.stroke();
            c.beginPath(); c.moveTo(-hw / 2, 0); c.lineTo(-hw / 2 + 3.5, 3.5); c.stroke();
            c.globalAlpha = 1;
        } else if (style === 'racer') {
            _bodyShape([6, 14, 14, 6]);
            // Rear spoiler (3D)
            const spG = c.createLinearGradient(-hw - 3, 0, -hw + 3, 0);
            spG.addColorStop(0, this._darkenColor(clr, 50));
            spG.addColorStop(0.5, this._darkenColor(clr, 20));
            spG.addColorStop(1, this._darkenColor(clr, 60));
            c.fillStyle = spG;
            c.beginPath(); c.roundRect(-hw - 3, -hh - 3, 6, hh * 2 + 6, 1); c.fill();
            // Spoiler struts
            c.strokeStyle = this._darkenColor(clr, 70); c.lineWidth = 1;
            c.beginPath(); c.moveTo(-hw, -hh + 3); c.lineTo(-hw - 2, -hh - 2); c.stroke();
            c.beginPath(); c.moveTo(-hw, hh - 3); c.lineTo(-hw - 2, hh + 2); c.stroke();
            if (car.charName === 'McQueen') {
                // Lightning bolt
                c.fillStyle = '#f5c518';
                c.shadowColor = 'rgba(245, 197, 24, 0.4)';
                c.shadowBlur = 6;
                c.beginPath();
                c.moveTo(-8, -hh + 2); c.lineTo(4, -4); c.lineTo(0, -3);
                c.lineTo(8, hh - 2); c.lineTo(-4, 4); c.lineTo(0, 3);
                c.closePath(); c.fill();
                c.shadowBlur = 0;
                // "95" with outline
                c.font = 'bold 9px Arial';
                c.textAlign = 'center'; c.textBaseline = 'middle';
                c.strokeStyle = '#c41010'; c.lineWidth = 2;
                c.strokeText('95', -hw / 2 + 1, 0);
                c.fillStyle = '#fff';
                c.fillText('95', -hw / 2 + 1, 0);
            }
            if (car.charName === 'Chick') {
                c.fillStyle = acc; c.globalAlpha = 0.5;
                c.beginPath(); c.roundRect(-8, -hh + 1, 16, 3, 1); c.fill();
                c.beginPath(); c.roundRect(-8, hh - 4, 16, 3, 1); c.fill();
                c.globalAlpha = 1;
                c.font = 'bold 8px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
                c.strokeStyle = this._darkenColor(clr, 60); c.lineWidth = 1.5;
                c.strokeText('86', -hw / 2 + 1, 0);
                c.fillStyle = '#fff'; c.fillText('86', -hw / 2 + 1, 0);
            }
        } else if (style === 'porsche') {
            _bodyShape([10, 16, 16, 10]);
            // Tattoo pinstripe
            c.strokeStyle = acc; c.lineWidth = 1; c.globalAlpha = 0.3;
            c.beginPath(); c.moveTo(-hw + 6, 0); c.lineTo(hw - 6, 0); c.stroke();
            c.globalAlpha = 1;
        } else if (style === 'hudson') {
            _bodyShape([4, 6, 6, 4]);
            // Chrome trim lines (shiny)
            const chromeG = c.createLinearGradient(-hw, 0, hw, 0);
            chromeG.addColorStop(0, '#708090'); chromeG.addColorStop(0.5, '#d0d8e0');
            chromeG.addColorStop(1, '#708090');
            c.strokeStyle = chromeG; c.lineWidth = 1;
            c.beginPath(); c.moveTo(-hw + 3, -hh + 5); c.lineTo(hw - 8, -hh + 5); c.stroke();
            c.beginPath(); c.moveTo(-hw + 3, hh - 5); c.lineTo(hw - 8, hh - 5); c.stroke();
            // "51" with Doc's blue styling
            c.font = 'bold 8px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillStyle = '#6090c0'; c.globalAlpha = 0.7;
            c.fillText('51', -hw / 2 + 2, 0);
            c.globalAlpha = 1;
        } else if (style === 'fiat') {
            _bodyShape(10);
        } else if (style === 'lowrider') {
            _bodyShape([5, 10, 10, 5]);
            // Flamed sides (metallic)
            c.globalAlpha = 0.55;
            for (let i = 0; i < 4; i++) {
                const fx = -hw + 5 + i * 7;
                const fG = c.createLinearGradient(fx, -hh, fx, -hh + 8);
                fG.addColorStop(0, '#ff4400'); fG.addColorStop(1, acc);
                c.fillStyle = fG;
                c.beginPath();
                c.moveTo(fx, -hh + 2); c.quadraticCurveTo(fx + 3, -hh + 7, fx + 5, -hh + 2);
                c.fill();
                c.beginPath();
                c.moveTo(fx, hh - 2); c.quadraticCurveTo(fx + 3, hh - 7, fx + 5, hh - 2);
                c.fill();
            }
            c.globalAlpha = 1;
        } else if (style === 'cruiser') {
            _bodyShape([5, 8, 8, 5]);
            // Light bar (3D with glow)
            const flash = Math.sin(Date.now() * 0.008) > 0;
            c.shadowBlur = 8;
            c.shadowColor = flash ? 'rgba(255,0,0,0.5)' : 'rgba(0,80,255,0.5)';
            c.fillStyle = flash ? '#ff3030' : '#3060ff';
            c.beginPath(); c.roundRect(-4, -hh - 4, 4, 4, 1); c.fill();
            c.shadowColor = flash ? 'rgba(0,80,255,0.5)' : 'rgba(255,0,0,0.5)';
            c.fillStyle = flash ? '#3060ff' : '#ff3030';
            c.beginPath(); c.roundRect(1, -hh - 4, 4, 4, 1); c.fill();
            c.shadowBlur = 0;
            // Star badge
            c.fillStyle = '#d4af37';
            this._drawStar(c, -hw / 2, 0, 4, 5);
        } else if (style === 'showcar') {
            _bodyShape([8, 12, 12, 8]);
            // Chrome bumper with reflection
            const bumperG = c.createLinearGradient(hw - 5, -hh, hw - 5, hh);
            bumperG.addColorStop(0, '#e8e8f0'); bumperG.addColorStop(0.5, '#a0a0b0');
            bumperG.addColorStop(1, '#e8e8f0');
            c.fillStyle = bumperG;
            c.beginPath(); c.roundRect(hw - 4, -hh + 3, 3, hh * 2 - 6, 1.5); c.fill();
        } else {
            _bodyShape(5);
        }

        // ═══════════════════════════════════════
        //  LAYER 4 — BODY OUTLINE + 3D EDGE
        // ═══════════════════════════════════════
        // Bottom edge (dark = depth)
        c.strokeStyle = this._darkenColor(clr, 75);
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(-hw + 5, hh); c.lineTo(hw - 5, hh);
        c.stroke();
        // Top edge (light = highlight)
        c.strokeStyle = this._lightenColor(clr, 50);
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(-hw + 5, -hh + 0.5); c.lineTo(hw - 5, -hh + 0.5);
        c.stroke();
        // Outline
        c.strokeStyle = this._darkenColor(clr, 55);
        c.lineWidth = 0.7;
        c.beginPath(); c.roundRect(-hw, -hh, hw * 2, hh * 2, 5); c.stroke();

        // ═══════════════════════════════════════
        //  LAYER 5 — SPECULAR HIGHLIGHT (gloss)
        // ═══════════════════════════════════════
        // Top body shine (curved highlight like car paint)
        const shineG = c.createLinearGradient(-hw, -hh, -hw, -hh + hh * 0.6);
        shineG.addColorStop(0, 'rgba(255,255,255,0.28)');
        shineG.addColorStop(0.4, 'rgba(255,255,255,0.08)');
        shineG.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = shineG;
        c.beginPath(); c.roundRect(-hw + 2, -hh + 1, hw * 2 - 4, hh * 0.7, [4, 4, 0, 0]); c.fill();

        // Glint line (the thin sharp highlight on polished cars)
        c.strokeStyle = 'rgba(255,255,255,0.30)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(-hw + 6, -hh + 3);
        c.quadraticCurveTo(0, -hh + 2, hw - 6, -hh + 3);
        c.stroke();

        // ═══════════════════════════════════════
        //  LAYER 6 — WINDSHIELD (glossy glass)
        // ═══════════════════════════════════════
        const wsLeft = hw - 14;
        const wsW = 12;
        const wsH = hh * 2 - 4;
        // Glass gradient
        const glassG = c.createLinearGradient(wsLeft, -hh, wsLeft + wsW, hh);
        glassG.addColorStop(0, 'rgba(140, 190, 240, 0.5)');
        glassG.addColorStop(0.4, 'rgba(100, 160, 220, 0.3)');
        glassG.addColorStop(1, 'rgba(80, 130, 190, 0.45)');
        c.fillStyle = glassG;
        c.beginPath(); c.roundRect(wsLeft, -hh + 2, wsW, wsH, [2, 4, 4, 2]); c.fill();
        // Glass reflection streak
        c.strokeStyle = 'rgba(255,255,255,0.35)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(wsLeft + 2, -hh + 4);
        c.quadraticCurveTo(wsLeft + wsW / 2, -hh + 3, wsLeft + wsW - 2, -hh + 5);
        c.stroke();
        // Glass edge (frame)
        c.strokeStyle = this._darkenColor(clr, 40);
        c.lineWidth = 0.7;
        c.beginPath(); c.roundRect(wsLeft, -hh + 2, wsW, wsH, [2, 4, 4, 2]); c.stroke();

        // ═══════════════════════════════════════
        //  LAYER 7 — EYES (3D with depth)
        // ═══════════════════════════════════════
        const eyeX = hw - 8;
        const eyeSpacing = style === 'fiat' ? 5 : 6;
        const eyeTopY = -eyeSpacing / 2 - 0.5;
        const eyeBotY = eyeSpacing / 2 - 0.5;
        const eyeW = style === 'fiat' ? 4.5 : 5.5;
        const eyeBaseH = 6 + face.eyeH;
        const eyeH = car.blinking > 0 ? 1.2 : eyeBaseH;

        // Eye sockets (subtle shadow around eyes)
        if (car.blinking <= 0) {
            c.fillStyle = 'rgba(0,0,0,0.08)';
            c.beginPath(); c.ellipse(eyeX, eyeTopY, eyeW / 2 + 1.5, eyeH / 2 + 1.5, 0, 0, 6.28); c.fill();
            c.beginPath(); c.ellipse(eyeX, eyeBotY, eyeW / 2 + 1.5, eyeH / 2 + 1.5, 0, 0, 6.28); c.fill();
        }

        // Eye whites (radial gradient for roundness)
        for (const ey of [eyeTopY, eyeBotY]) {
            const ewG = c.createRadialGradient(eyeX - 0.5, ey - 0.5, 0, eyeX, ey, eyeW / 2);
            ewG.addColorStop(0, '#ffffff');
            ewG.addColorStop(0.7, '#f0f0f0');
            ewG.addColorStop(1, '#d8d8d8');
            c.fillStyle = ewG;
            c.beginPath(); c.ellipse(eyeX, ey, eyeW / 2, eyeH / 2, 0, 0, 6.28); c.fill();
        }

        // Pupils + iris
        if (car.blinking <= 0) {
            for (const ey of [eyeTopY, eyeBotY]) {
                // Iris ring
                c.fillStyle = '#334';
                c.beginPath(); c.arc(eyeX + 0.8, ey, 2.6, 0, 6.28); c.fill();
                // Pupil (deep black)
                c.fillStyle = '#0a0a12';
                c.beginPath(); c.arc(eyeX + 0.8, ey, 1.6, 0, 6.28); c.fill();
                // Main highlight (large)
                c.fillStyle = 'rgba(255,255,255,0.95)';
                c.beginPath(); c.arc(eyeX + 1.8, ey - 1.2, 1, 0, 6.28); c.fill();
                // Secondary highlight (small, opposite side)
                c.fillStyle = 'rgba(255,255,255,0.5)';
                c.beginPath(); c.arc(eyeX - 0.3, ey + 0.8, 0.5, 0, 6.28); c.fill();
            }
        }

        // Eyebrows (thicker, more expressive)
        if (face.brow !== 0 && car.blinking <= 0) {
            c.strokeStyle = this._darkenColor(clr, 80);
            c.lineWidth = 1.6;
            c.lineCap = 'round';
            const bt = face.brow * 1.8;
            c.beginPath();
            c.moveTo(eyeX - 3.5, eyeTopY - eyeH / 2 - 2 - bt);
            c.lineTo(eyeX + 3.5, eyeTopY - eyeH / 2 - 2 + bt);
            c.stroke();
            c.beginPath();
            c.moveTo(eyeX - 3.5, eyeBotY - eyeH / 2 - 2 + bt);
            c.lineTo(eyeX + 3.5, eyeBotY - eyeH / 2 - 2 - bt);
            c.stroke();
            c.lineCap = 'butt';
        }

        // ═══════════════════════════════════════
        //  LAYER 8 — MOUTH / BUMPER (character)
        // ═══════════════════════════════════════
        const mouthX = hw - 1;
        if (car.charName === 'Mater') {
            // Buck teeth (3D)
            c.fillStyle = '#f0edd0';
            c.strokeStyle = '#bbb';
            c.lineWidth = 0.8;
            c.beginPath(); c.roundRect(mouthX - 1.5, -3, 4, 6, 1); c.fill(); c.stroke();
            c.strokeStyle = '#ccc'; c.lineWidth = 0.5;
            c.beginPath(); c.moveTo(mouthX + 0.5, -3); c.lineTo(mouthX + 0.5, 3); c.stroke();
        } else {
            // Chrome bumper grille
            const grG = c.createLinearGradient(mouthX - 1, -4, mouthX + 2, 4);
            grG.addColorStop(0, '#a0a0a8'); grG.addColorStop(0.5, '#d0d0d8');
            grG.addColorStop(1, '#808088');
            c.strokeStyle = grG;
            c.lineWidth = 1.5;
            c.beginPath();
            if (face.mouth === 1) {
                c.arc(mouthX, 0, 4.5, -0.7, 0.7);
            } else if (face.mouth === -1) {
                c.arc(mouthX + 3, 0, 4.5, Math.PI - 0.5, Math.PI + 0.5);
            } else {
                c.moveTo(mouthX, -3); c.lineTo(mouthX, 3);
            }
            c.stroke();
        }

        // ═══════════════════════════════════════
        //  LAYER 9 — HEADLIGHTS (with glow)
        // ═══════════════════════════════════════
        const isNight = this.weather === WEATHER_NIGHT;
        for (const ly of [-hh + 4, hh - 4]) {
            // Glow halo
            if (isNight) {
                c.fillStyle = 'rgba(255,240,150,0.15)';
                c.beginPath(); c.arc(hw, ly, 7, 0, 6.28); c.fill();
            }
            // Headlight body
            const hlG = c.createRadialGradient(hw - 1, ly, 0, hw - 1, ly, 3.5);
            hlG.addColorStop(0, isNight ? '#fffde0' : '#f8f0c0');
            hlG.addColorStop(0.5, isNight ? '#ffe880' : '#e0d898');
            hlG.addColorStop(1, isNight ? '#ccb040' : '#b0a870');
            c.fillStyle = hlG;
            c.beginPath(); c.arc(hw - 1, ly, 3, 0, 6.28); c.fill();
            // Headlight glint
            c.fillStyle = 'rgba(255,255,255,0.7)';
            c.beginPath(); c.arc(hw - 0.5, ly - 1, 0.8, 0, 6.28); c.fill();
        }

        // ═══════════════════════════════════════
        //  LAYER 10 — TAILLIGHTS (with glow)
        // ═══════════════════════════════════════
        for (const ly of [-hh + 4, hh - 4]) {
            // Red glow
            c.fillStyle = 'rgba(200,30,30,0.12)';
            c.beginPath(); c.arc(-hw + 2, ly, 5, 0, 6.28); c.fill();
            // Taillight
            const tlG = c.createRadialGradient(-hw + 2, ly, 0, -hw + 2, ly, 2.5);
            tlG.addColorStop(0, '#ff4040');
            tlG.addColorStop(0.6, '#c02020');
            tlG.addColorStop(1, '#801010');
            c.fillStyle = tlG;
            c.beginPath(); c.arc(-hw + 2, ly, 2.2, 0, 6.28); c.fill();
            // Glint
            c.fillStyle = 'rgba(255,150,150,0.6)';
            c.beginPath(); c.arc(-hw + 2.5, ly - 0.7, 0.6, 0, 6.28); c.fill();
        }

        // ═══════════════════════════════════════
        //  LAYER 11 — NAME TAG
        // ═══════════════════════════════════════
        c.save();
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.font = 'bold 5px Arial';
        c.textAlign = 'center'; c.textBaseline = 'top';
        c.fillText(car.charName, 0, hh + 2);
        c.restore();

        // ═══════════════════════════════════════
        //  LAYER 12 — TOWN VISIT CHECKMARK
        // ═══════════════════════════════════════
        if (car.touchedTown) {
            c.fillStyle = 'rgba(60, 200, 90, 0.8)';
            c.shadowColor = 'rgba(60,200,90,0.4)';
            c.shadowBlur = 6;
            c.beginPath(); c.arc(-hw - 6, 0, 4.5, 0, 6.28); c.fill();
            c.shadowBlur = 0;
            c.fillStyle = '#fff';
            c.font = 'bold 7px Arial';
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText('\u2713', -hw - 6, 0.3);
        }

        c.restore();
    }

    // Draw a 5-pointed star for Sheriff badge
    _drawStar(c, cx, cy, r, points) {
        c.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const rad = (i % 2 === 0) ? r : r * 0.45;
            const angle = (Math.PI / points) * i - Math.PI / 2;
            const x = cx + rad * Math.cos(angle);
            const y = cy + rad * Math.sin(angle);
            if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.closePath(); c.fill();
    }

    // Color helpers for 3D car shading
    _lightenColor(hex, amount) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.min(255, (num >> 16) + amount);
        const g = Math.min(255, ((num >> 8) & 0xFF) + amount);
        const b = Math.min(255, (num & 0xFF) + amount);
        return `rgb(${r},${g},${b})`;
    }
    _darkenColor(hex, amount) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (num >> 16) - amount);
        const g = Math.max(0, ((num >> 8) & 0xFF) - amount);
        const b = Math.max(0, (num & 0xFF) - amount);
        return `rgb(${r},${g},${b})`;
    }
}

// ==================== BOOT ====================
window.addEventListener('DOMContentLoaded', () => new Game());
