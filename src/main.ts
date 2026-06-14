import { MarkdownRenderChild, Menu, Notice, Plugin } from 'obsidian';
import { Infographic, InfographicOptions } from '@antv/infographic';
import { DEFAULT_SETTINGS, InfographicSettings, InfographicSettingTab } from './settings';

class InfographicRenderChild extends MarkdownRenderChild {
	private instance: Infographic | null = null;

	constructor(
		containerEl: HTMLElement,
		private readonly plugin: InfographicPlugin,
		private readonly content: string
	) {
		super(containerEl);
	}

	onload(): void {
		this.containerEl.empty();
		const wrapper = this.containerEl.createDiv('infographic-wrapper');

		try {
				this.instance = new Infographic({
					container: wrapper,
					...this.plugin.settingsToOptions(),
				});
				this.instance.render(this.content);
				this.registerDomEvent(wrapper, 'contextmenu', (event: MouseEvent) => void this.showContextMenu(event));
				this.registerEvent(this.plugin.app.workspace.on('css-change', () => this.updateThemeForCssChange()));
		} catch (error) {
			console.error('Infographic render error:', error);
			wrapper.createDiv({
				cls: 'infographic-error',
				text: `渲染失败: ${error instanceof Error ? error.message : String(error)}`
			});
		}
	}

	onunload(): void {
		this.instance?.destroy();
		this.instance = null;
	}

	private updateThemeForCssChange(): void {
		if (!this.instance) {
			return;
		}

		try {
			this.instance.update(this.plugin.settingsToOptions());
		} catch (error) {
			console.error('Infographic theme update error:', error);
		}
	}

	private async showContextMenu(event: MouseEvent): Promise<void> {
		if (!this.instance) {
			return;
		}

		event.preventDefault();
		const menu = new Menu();
		const instance = this.instance;

		menu.addItem((item) =>
			item
				.setTitle('复制')
				.setIcon('copy')
				.onClick(async () => {
					try {
						const dataUrl = await instance.toDataURL();
						const blob = this.plugin.dataUrlToBlob(dataUrl);

						await navigator.clipboard.write([
							new ClipboardItem({
								'image/png': blob
							})
						]);

						new Notice('图表已复制到剪贴板');
					} catch (error) {
						console.error('Copy error:', error);
						new Notice('复制失败: ' + (error instanceof Error ? error.message : String(error)));
					}
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('导出为 PNG')
				.setIcon('image-file')
				.onClick(async () => {
					try {
						const dataUrl = await instance.toDataURL();
						const link = activeDocument.createElement('a');
						link.href = dataUrl;
						link.download = `infographic-${Date.now()}.png`;
						link.click();

						new Notice('图表已导出为 PNG');
					} catch (error) {
						console.error('Export error:', error);
						new Notice('导出失败: ' + (error instanceof Error ? error.message : String(error)));
					}
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('导出为 SVG')
				.setIcon('image-file')
				.onClick(async () => {
					try {
						const dataUrl = await instance.toDataURL({
							type: 'svg',
							embedResources: true,
							removeIds: false
						});
						const link = activeDocument.createElement('a');
						link.href = dataUrl;
						link.download = `infographic-${Date.now()}.svg`;
						link.click();

						new Notice('图表已导出为 SVG');
					} catch (error) {
						console.error('Export error:', error);
						new Notice('导出失败: ' + (error instanceof Error ? error.message : String(error)));
					}
				})
		);

		menu.showAtMouseEvent(event);
	}
}

export default class InfographicPlugin extends Plugin {
	settings: InfographicSettings;

	async onload() {
		await this.loadSettings();

		// 添加设置选项卡
		this.addSettingTab(new InfographicSettingTab(this.app, this));

		// 注册 infographic 代码块处理器
		this.registerMarkdownCodeBlockProcessor('infographic', (content, el, ctx) => {
			ctx.addChild(new InfographicRenderChild(el, this, content));
		});
	}

	onunload() {
		// 清理工作由 Obsidian 自动处理
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<InfographicSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 辅助函数：将 data URL 转换为 Blob
	dataUrlToBlob(dataUrl: string): Blob {
		const arr = dataUrl.split(',');
		if (arr.length < 2 || !arr[0] || !arr[1]) {
			throw new Error('Invalid data URL');
		}

		const mimeMatch = arr[0].match(/:(.*?);/);
		const mime = mimeMatch?.[1] || 'image/png';
		const bstr = atob(arr[1]);
		let n = bstr.length;
		const u8arr = new Uint8Array(n);
		while (n--) {
			u8arr[n] = bstr.charCodeAt(n);
		}
		return new Blob([u8arr], { type: mime });
	}

	settingsToOptions(): Partial<InfographicOptions> {
		const options: Partial<InfographicOptions> = {};
		const theme = this.resolveTheme();

		// 如果设置了默认主题，则应用
		if (theme) {
			options.theme = theme;
		}

		return options;
	}

	private resolveTheme(): string {
		const selectedTheme = this.settings.defaultTheme ?? 'auto';
		if (selectedTheme !== 'auto') {
			return selectedTheme;
		}

		return activeDocument.body.classList.contains('theme-dark') ? 'dark' : 'default';
	}
}
