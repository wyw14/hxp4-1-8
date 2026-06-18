type Color = 'red' | 'yellow' | 'blue' | 'green';

const COLORS: Color[] = ['red', 'yellow', 'blue', 'green'];

interface HighScoreResponse {
  highScore: number;
  isNewRecord?: boolean;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

interface AchievementStats {
  gamesPlayed: number;
  bestScore: number;
  lastThreeScores: number[];
  hasBrokenRecord: boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_game',
    name: '初次尝试',
    description: '首次完成一局游戏',
    icon: '🎮',
    unlocked: false,
  },
  {
    id: 'level_5',
    name: '记忆达人',
    description: '达到第5关',
    icon: '🧠',
    unlocked: false,
  },
  {
    id: 'three_improvements',
    name: '节节攀升',
    description: '连续三局成绩进步',
    icon: '📈',
    unlocked: false,
  },
  {
    id: 'first_record',
    name: '纪录缔造者',
    description: '首次打破最高纪录',
    icon: '🏆',
    unlocked: false,
  },
];

class ColorMemoryGame {
  private sequence: Color[] = [];
  private playerIndex: number = 0;
  private isPlaying: boolean = false;
  private isShowingSequence: boolean = false;
  private level: number = 0;
  private highScore: number = 0;

  private achievements: Achievement[] = [];
  private achievementStats: AchievementStats = {
    gamesPlayed: 0,
    bestScore: 0,
    lastThreeScores: [],
    hasBrokenRecord: false,
  };

  private achievementBadgeQueue: Achievement[] = [];
  private isShowingBadge: boolean = false;

  private readonly buttons: NodeListOf<HTMLButtonElement>;
  private readonly startBtn: HTMLButtonElement;
  private readonly currentLevelEl: HTMLElement;
  private readonly highScoreEl: HTMLElement;
  private readonly gameStatusEl: HTMLElement;
  private readonly achievementBadgeEl: HTMLElement;
  private readonly achievementsBtn: HTMLButtonElement;
  private readonly achievementsPanel: HTMLElement;
  private readonly achievementsListEl: HTMLElement;

  private readonly lightOnDuration: number = 600;
  private readonly lightOffDuration: number = 300;
  private readonly badgeShowDuration: number = 3000;
  private readonly badgeHideDuration: number = 500;

  constructor() {
    this.buttons = document.querySelectorAll('.color-btn');
    this.startBtn = document.getElementById('start-btn') as HTMLButtonElement;
    this.currentLevelEl = document.getElementById('current-level') as HTMLElement;
    this.highScoreEl = document.getElementById('high-score') as HTMLElement;
    this.gameStatusEl = document.getElementById('game-status') as HTMLElement;
    this.achievementBadgeEl = document.getElementById('achievement-badge') as HTMLElement;
    this.achievementsBtn = document.getElementById('achievements-btn') as HTMLButtonElement;
    this.achievementsPanel = document.getElementById('achievements-panel') as HTMLElement;
    this.achievementsListEl = document.getElementById('achievements-list') as HTMLElement;

    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.loadAchievements();
      this.setupEventListeners();
      this.renderAchievementsList();
      this.updateAchievementsBtnCount();
      await this.fetchHighScore();
    } catch (error) {
      console.error('初始化失败:', error);
      this.showStatus('⚠️ 初始化异常，请刷新页面重试', 'gameover');
    }
  }

  private setupEventListeners(): void {
    this.startBtn.addEventListener('click', () => this.startGame());

    this.buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = (e.target as HTMLButtonElement).dataset.color as Color;
        this.handlePlayerInput(color);
      });
    });

    this.achievementsBtn.addEventListener('click', () => this.toggleAchievementsPanel());

    const closeBtn = document.getElementById('close-achievements');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleAchievementsPanel());
    }
  }

  private async fetchHighScore(): Promise<void> {
    try {
      const response = await fetch('/api/highscore');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json() as HighScoreResponse;
      this.highScore = data.highScore;
      this.highScoreEl.textContent = this.highScore.toString();
    } catch (error) {
      console.error('获取最高分失败:', error);
      this.showStatus('⚠️ 获取最高分失败', '');
    }
  }

  private async saveHighScore(score: number): Promise<boolean> {
    try {
      const response = await fetch('/api/highscore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ score }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as HighScoreResponse;
      this.highScore = data.highScore;
      this.highScoreEl.textContent = this.highScore.toString();

      if (data.isNewRecord) {
        this.showStatus('🎉 新纪录！', 'success');
      }

      return data.isNewRecord === true;
    } catch (error) {
      console.error('保存最高分失败:', error);
      this.showStatus('⚠️ 保存分数失败', '');
      return false;
    }
  }

  private startGame(): void {
    this.sequence = [];
    this.playerIndex = 0;
    this.level = 0;
    this.isPlaying = true;
    this.currentLevelEl.textContent = '0';

    this.setButtonsDisabled(true);
    this.startBtn.disabled = true;

    this.showStatus('游戏开始！', 'playing');
    this.nextRound();
  }

  private nextRound(): void {
    this.level++;
    this.currentLevelEl.textContent = this.level.toString();
    this.playerIndex = 0;

    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.sequence.push(randomColor);

    this.checkLevelAchievement(this.level);

    this.showStatus(`第 ${this.level} 关 - 记住序列`, 'playing');
    this.showSequence();
  }

  private async showSequence(): Promise<void> {
    this.isShowingSequence = true;
    this.setButtonsDisabled(true);

    await this.delay(500);

    for (let i = 0; i < this.sequence.length; i++) {
      const color = this.sequence[i];
      await this.lightUpButton(color);

      if (i < this.sequence.length - 1) {
        await this.delay(this.lightOffDuration);
      }
    }

    this.isShowingSequence = false;
    this.setButtonsDisabled(false);
    this.showStatus('请按顺序点击按钮', 'playing');
  }

  private async lightUpButton(color: Color): Promise<void> {
    const button = this.getButtonByColor(color);
    if (!button) return;

    button.classList.add('active');
    await this.delay(this.lightOnDuration);
    button.classList.remove('active');
  }

  private getButtonByColor(color: Color): HTMLButtonElement | null {
    return document.querySelector(`.color-btn[data-color="${color}"]`);
  }

  private async handlePlayerInput(color: Color): Promise<void> {
    if (!this.isPlaying || this.isShowingSequence) return;

    const expectedColor = this.sequence[this.playerIndex];
    const button = this.getButtonByColor(color);

    if (color === expectedColor) {
      button?.classList.add('correct');
      await this.delay(200);
      button?.classList.remove('correct');

      this.playerIndex++;

      if (this.playerIndex === this.sequence.length) {
        this.showStatus('正确！准备下一关...', 'success');
        this.setButtonsDisabled(true);
        await this.delay(1000);
        this.nextRound();
      }
    } else {
      button?.classList.add('wrong');
      await this.delay(500);
      button?.classList.remove('wrong');

      this.gameOver();
    }
  }

  private async gameOver(): Promise<void> {
    this.isPlaying = false;
    this.setButtonsDisabled(true);
    this.startBtn.disabled = false;

    const finalScore = this.level - 1;
    this.showStatus(`游戏结束！你完成了 ${finalScore} 关`, 'gameover');

    const isPotentialNewRecord = finalScore > this.highScore;
    let isConfirmedNewRecord = false;

    if (isPotentialNewRecord) {
      isConfirmedNewRecord = await this.saveHighScore(finalScore);
    }

    this.updateAchievementStats(finalScore, isConfirmedNewRecord);
    this.checkGameOverAchievements(finalScore, isConfirmedNewRecord);
  }

  private setButtonsDisabled(disabled: boolean): void {
    this.buttons.forEach(btn => {
      btn.disabled = disabled;
    });
  }

  private showStatus(message: string, type: 'playing' | 'gameover' | 'success' | '' = ''): void {
    if (!this.gameStatusEl) return;
    this.gameStatusEl.textContent = message;
    this.gameStatusEl.className = 'game-status';
    if (type) {
      this.gameStatusEl.classList.add(type);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private loadAchievements(): void {
    try {
      const savedAchievements = localStorage.getItem('colorMemory_achievements');
      const savedStats = localStorage.getItem('colorMemory_achievementStats');

      if (savedAchievements) {
        const parsed = JSON.parse(savedAchievements);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.achievements = parsed;
        } else {
          this.achievements = JSON.parse(JSON.stringify(ACHIEVEMENTS));
        }
      } else {
        this.achievements = JSON.parse(JSON.stringify(ACHIEVEMENTS));
      }

      if (savedStats) {
        const parsedStats = JSON.parse(savedStats);
        this.achievementStats = {
          gamesPlayed: typeof parsedStats.gamesPlayed === 'number' ? parsedStats.gamesPlayed : 0,
          bestScore: typeof parsedStats.bestScore === 'number' ? parsedStats.bestScore : 0,
          lastThreeScores: Array.isArray(parsedStats.lastThreeScores) ? parsedStats.lastThreeScores.slice(0, 3) : [],
          hasBrokenRecord: typeof parsedStats.hasBrokenRecord === 'boolean' ? parsedStats.hasBrokenRecord : false,
        };
      }
    } catch (error) {
      console.error('加载成就数据失败:', error);
      this.achievements = JSON.parse(JSON.stringify(ACHIEVEMENTS));
      this.achievementStats = {
        gamesPlayed: 0,
        bestScore: 0,
        lastThreeScores: [],
        hasBrokenRecord: false,
      };
    }
  }

  private saveAchievements(): void {
    try {
      localStorage.setItem('colorMemory_achievements', JSON.stringify(this.achievements));
      localStorage.setItem('colorMemory_achievementStats', JSON.stringify(this.achievementStats));
    } catch (error) {
      console.error('保存成就数据失败:', error);
      this.showStatus('⚠️ 成就保存失败', '');
    }
  }

  private updateAchievementStats(score: number, isNewRecord: boolean): void {
    this.achievementStats.gamesPlayed++;
    if (score > this.achievementStats.bestScore) {
      this.achievementStats.bestScore = score;
    }

    this.achievementStats.lastThreeScores.push(score);
    if (this.achievementStats.lastThreeScores.length > 3) {
      this.achievementStats.lastThreeScores.shift();
    }

    if (isNewRecord) {
      this.achievementStats.hasBrokenRecord = true;
    }

    this.saveAchievements();
  }

  private checkLevelAchievement(level: number): void {
    if (level >= 5) {
      this.unlockAchievement('level_5');
    }
  }

  private checkGameOverAchievements(_score: number, isNewRecord: boolean): void {
    if (this.achievementStats.gamesPlayed >= 1) {
      this.unlockAchievement('first_game');
    }

    if (isNewRecord) {
      this.unlockAchievement('first_record');
    }

    const scores = this.achievementStats.lastThreeScores;
    if (scores.length === 3 && scores[0] < scores[1] && scores[1] < scores[2]) {
      this.unlockAchievement('three_improvements');
    }
  }

  private unlockAchievement(id: string): void {
    const achievement = this.achievements.find(a => a.id === id);
    if (!achievement || achievement.unlocked) return;

    achievement.unlocked = true;
    achievement.unlockedAt = Date.now();
    this.saveAchievements();

    this.enqueueAchievementBadge(achievement);
    this.renderAchievementsList();
    this.updateAchievementsBtnCount();
  }

  private enqueueAchievementBadge(achievement: Achievement): void {
    this.achievementBadgeQueue.push(achievement);
    if (!this.isShowingBadge) {
      this.processBadgeQueue();
    }
  }

  private async processBadgeQueue(): Promise<void> {
    if (this.achievementBadgeQueue.length === 0) {
      this.isShowingBadge = false;
      return;
    }

    this.isShowingBadge = true;
    const achievement = this.achievementBadgeQueue.shift()!;

    this.displayAchievementBadge(achievement);
    await this.delay(this.badgeShowDuration);
    this.hideAchievementBadge();
    await this.delay(this.badgeHideDuration);

    this.processBadgeQueue();
  }

  private displayAchievementBadge(achievement: Achievement): void {
    if (!this.achievementBadgeEl) return;

    const badgeIcon = this.achievementBadgeEl.querySelector('.badge-icon') as HTMLElement;
    const badgeName = this.achievementBadgeEl.querySelector('.badge-name') as HTMLElement;
    const badgeDesc = this.achievementBadgeEl.querySelector('.badge-desc') as HTMLElement;

    if (badgeIcon) badgeIcon.textContent = achievement.icon;
    if (badgeName) badgeName.textContent = achievement.name;
    if (badgeDesc) badgeDesc.textContent = achievement.description;

    this.achievementBadgeEl.classList.add('show');
  }

  private hideAchievementBadge(): void {
    if (!this.achievementBadgeEl) return;
    this.achievementBadgeEl.classList.remove('show');
  }

  private toggleAchievementsPanel(): void {
    if (!this.achievementsPanel) return;
    this.achievementsPanel.classList.toggle('show');
  }

  private updateAchievementsBtnCount(): void {
    if (!this.achievementsBtn) return;
    const unlockedCount = this.achievements.filter(a => a.unlocked).length;
    this.achievementsBtn.textContent = `🏆 成就 ${unlockedCount}/${this.achievements.length}`;
  }

  private renderAchievementsList(): void {
    if (!this.achievementsListEl) return;

    this.achievementsListEl.innerHTML = '';

    this.achievements.forEach(achievement => {
      const item = document.createElement('div');
      item.className = `achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`;

      let dateText = '';
      if (achievement.unlocked && achievement.unlockedAt) {
        const date = new Date(achievement.unlockedAt);
        dateText = `<div class="achievement-date">${date.toLocaleDateString('zh-CN')}</div>`;
      }

      item.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${achievement.name}</div>
          <div class="achievement-desc">${achievement.description}</div>
          ${dateText}
        </div>
        <div class="achievement-status">
          ${achievement.unlocked ? '✓ 已解锁' : '🔒 未解锁'}
        </div>
      `;
      this.achievementsListEl.appendChild(item);
    });
  }
}

new ColorMemoryGame();
