import { App, Modal, Setting } from "obsidian";

export class CryptoModal extends Modal {
	base: string;
	target: string;

	onSubmit: (base: string, target: string) => void;

	constructor(
		app: App,
		defaultTarget: string,
		onSubmit: (base: string, target: string) => void
	) {
		super(app);
		this.target = defaultTarget;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: "Select crypto base and target" });

		new Setting(contentEl).setName("Base").addText((text) =>
			text
				.setValue(this.base).onChange((value) => {
				this.base = value;
			}).inputEl.focus()
		);

		new Setting(contentEl).setName("Target").addText((text) =>
			text.setValue(this.target).onChange((value) => {
				this.target = value;
			})
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Lookup")
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit(this.base, this.target);
				})
		);
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}
