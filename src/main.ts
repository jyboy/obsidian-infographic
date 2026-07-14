import { MarkdownRenderChild, Menu, Notice, Plugin } from 'obsidian';
import { Infographic } from '@antv/infographic';

type ObsidianWindow = Window & {
	createEl: (tag: 'a') => HTMLAnchorElement;
};

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
			this.instance = new Infographic({ container: wrapper });
			this.instance.render(this.contentWithObsidianTheme());
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
			this.instance.render(this.contentWithObsidianTheme());
		} catch (error) {
			console.error('Infographic theme update error:', error);
		}
	}

	private contentWithObsidianTheme(): string {
		const content = this.content.replace(/^theme(?:\s+.*)?(?:\r?\n(?: {2,}|\t).*)*(?:\r?\n)?/m, '');
		return this.plugin.app.isDarkMode() ? `theme dark\n${content}` : content;
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
				.setTitle('Copy infographic as PNG')
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

						new Notice('Infographic copied as PNG');
					} catch (error) {
						console.error('Copy error:', error);
						new Notice('Could not copy infographic: ' + (error instanceof Error ? error.message : String(error)));
					}
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Export infographic as PNG')
				.setIcon('image-file')
				.onClick(async () => {
					try {
						const dataUrl = await instance.toDataURL();
						const link = (activeWindow as ObsidianWindow).createEl('a');
						link.href = dataUrl;
						link.download = `infographic-${Date.now()}.png`;
						link.click();

						new Notice('Infographic exported as PNG');
					} catch (error) {
						console.error('Export error:', error);
						new Notice('Could not export infographic: ' + (error instanceof Error ? error.message : String(error)));
					}
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Export infographic as SVG')
				.setIcon('image-file')
				.onClick(async () => {
					try {
						const dataUrl = await instance.toDataURL({
							type: 'svg',
							embedResources: true,
							removeIds: false
						});
						const link = (activeWindow as ObsidianWindow).createEl('a');
						link.href = dataUrl;
						link.download = `infographic-${Date.now()}.svg`;
						link.click();

						new Notice('Infographic exported as SVG');
					} catch (error) {
						console.error('Export error:', error);
						new Notice('Could not export infographic: ' + (error instanceof Error ? error.message : String(error)));
					}
				})
		);

		menu.showAtMouseEvent(event);
	}
}

export default class InfographicPlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor('infographic', (content, el, ctx) => {
			ctx.addChild(new InfographicRenderChild(el, this, content));
		});
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

}
