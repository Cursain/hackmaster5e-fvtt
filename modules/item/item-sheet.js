import { HMTABLES } from '../sys/constants.js'

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class HMItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["hackmaster", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }]
    });
  }

  /** @override */
  get template() {
    const path = "systems/hackmaster5e/templates/item";
    return `${path}/item-${this.item.data.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options = {}) {
    const position = super.setPosition(options);
    const sheetBody = this.element.find(".sheet-body");
    const bodyHeight = position.height - 192;
    sheetBody.css("height", bodyHeight);
    return position;
  }

  /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        if (!this.options.editable) return;

        html.find('.dropdown').change(this._onChangeDropdown.bind(this));
    }

    _onChangeDropdown(ev) {
        ev.preventDefault();
        const element = ev.currentTarget;
        const dataset = element.dataset;

        const ref1    = dataset.ref1;
        const ref2    = $(element).val();
        const ref3    = dataset.ref3;
        if (ref2 === '0') { return; }

        const key     = dataset.key;
        const value   = HMTABLES[ref1][ref2][ref3];
        const data    = {[key]: value};
        return this.item.update(data);
    }
}
