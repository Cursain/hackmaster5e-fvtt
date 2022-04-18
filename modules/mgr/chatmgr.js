import { HMTABLES, HMCONST } from '../sys/constants.js';

function getDiceSum(roll) {
    let sum = 0;
    for (let i = 0; i < roll.terms.length; i++) {
        for (let j = 0; j < roll.terms[i]?.results?.length; j++) {
            sum += roll.terms[i].results[j].result;
        }
    }
    return sum;
}

// Gross.
async function saveExtendedTrauma(content, roll) {
    if (roll.total < 1) {
        return `<b>${game.i18n.localize('HM.success')}</b><br>${content}`;
    }

    let newcontent = content;
    let duration = Math.max(roll.total * 5, 0);
    let unit    = game.i18n.localize('HM.seconds');
    let status  = game.i18n.localize('HM.incapacitated');
    let special = game.i18n.localize('HM.failed');
    let comaForever = false;
    let label;

    if (getDiceSum(roll) === 20) {
        const critRoll = await new Roll('5d6p').evaluate({async: true});
        let flavor = `${game.i18n.localize('HM.knockout')} ${game.i18n.localize('HM.duration')}`;
        newcontent += `<br> ${await critRoll.render({flavor})}`;
        duration = critRoll.total;
        unit = game.i18n.localize('HM.minutes');
        status = game.i18n.localize('HM.knockedout');
        special = game.i18n.localize('HM.critical');
        const comaRoll = await new Roll('d20').evaluate({async: true});
        flavor = `${game.i18n.localize('HM.comatose')} ${game.i18n.localize('HM.check')}`;
        newcontent += `<br> ${await comaRoll.render({flavor})}`;

        if (comaRoll.total === 20) {
            special = `${game.i18n.localize('HM.double')} ${game.i18n.localize('HM.critical')}`;
            const coma2Roll = await new Roll('d20').evaluate({async: true});
            flavor = `${game.i18n.localize('HM.comatose')} ${game.i18n.localize('HM.duration')}`;
            newcontent += `<br> ${await coma2Roll.render({flavor})}`;
            duration = coma2Roll.total;
            unit = 'HM.days';
            status = 'HM.comatose';
            if (coma2Roll.total === 20) comaForever = true;
        }
    }

    if (comaForever) {
        label = `<b>Goodbye</b>
                 <br>${game.i18n.localize(status)}
                 <u>${game.i18n.localize('HM.indefinitely')}</u>.`;
    } else {
        label = `<b>${game.i18n.localize(special)}</b><br><i>${game.i18n.localize(status)}</i> for
                 <b>${duration}</b> ${game.i18n.localize(unit).toLowerCase()}.`;
    }
    return label + newcontent;
}

async function createSaveCard(roll, dataset) {
    let saveType = (dataset.formulaType === 'fos' || dataset.formulaType === 'foa') ? 'Feat of ' : '';
    if (dataset.ability) {
        saveType = game.i18n.localize(`HM.abilityLong.${dataset.ability.toLowerCase()}`);
    } else {
        saveType += game.i18n.localize(`HM.saves.${dataset.formulaType}`);
    }
    const flavor = `${saveType} ${game.i18n.localize('HM.save')}`;
    let content = await roll.render({flavor});
    if (dataset.formulaType === 'trauma') content = await saveExtendedTrauma(content, roll);
    return {content};
}

async function createAbilityCard(roll, dataset) {
    const saveType = game.i18n.localize(`HM.abilityLong.${dataset.ability.toLowerCase()}`);
    const flavor = `${saveType} ${game.i18n.localize('HM.check')}`;
    const content = await roll.render({flavor});
    return {content};
}

async function createToPAlert(dataset) {
    const template = 'systems/hackmaster5e/templates/chat/top.hbs';
    const content = await renderTemplate(template, dataset);
    const flavor = dataset.context.parent.name;
    return {content, flavor};
}

export class HMChatMgr {
    constructor() { this._user = game.user.id; }

    async getCard({cardtype=HMCONST.CARD_TYPE.ROLL, roll, dataset, dialogResp=null, options}) {
        let cData;
        if (cardtype === HMCONST.CARD_TYPE.ROLL) {
            switch (dataset.dialog) {
                case 'atk':
                case 'ratk':
                case 'def':
                case 'dmg':
                    cData = await this._createWeaponCard(roll, dataset, dialogResp);
                    break;
                case 'cast':
                    cData = await this._createSpellCard(dataset, dialogResp);
                    break;
                case 'skill':
                    cData = await this._createSkillCard(roll, dataset, dialogResp);
                    break;
                case 'save':
                    cData = await createSaveCard(roll, dataset);
                    break;
                case 'ability':
                    cData = dialogResp.resp.save
                        ? await createSaveCard(roll, dataset)
                        : await createAbilityCard(roll, dataset);
                    break;
                default:
            }
        } else if (cardtype === HMCONST.CARD_TYPE.ALERT) {
            cData = await createToPAlert(dataset);
        }

        const chatData = {
            user:    this._user,
            flavor:  cData?.flavor || dialogResp?.caller?.name,
            content: cData.content,
            type:    CONST.CHAT_MESSAGE_TYPES.OTHER,
        };

        if (roll) {
            chatData.roll     = roll;
            chatData.rollMode = cData.rollMode ? cData.rollMode : game.settings.get('core', 'rollMode');
            chatData.type     = CONST.CHAT_MESSAGE_TYPES.ROLL;
            chatData.sound    = CONFIG.sounds.dice;
        }

        return {...chatData, ...options};
    }

    async _createWeaponCard(roll, dataset, dialogResp) {
        const {caller} = dialogResp;
        const item = dialogResp.context;

        switch (dataset.dialog) {
            case 'ratk': {
                const flavor = `${game.i18n.localize('HM.ranged')}
                                ${game.i18n.localize('HM.attack')}
                                ${game.i18n.localize('HM.roll')}`;
                let content = await roll.render({flavor});

                const weaponRow = `${game.i18n.localize('HM.weapon')}:
                                <b>${item.name}</b>`;
                const speedRow  = `${game.i18n.localize('HM.speed')}:
                                <b>${item.data.data.bonus.total.spd}</b>`;
                const rangeRow  = `${game.i18n.localize('HM.range')}:
                                <b>${game.i18n.localize(`HM.${dialogResp.resp.rangestr}`)}</b>`;

                let specialRow = '';
                const sumDice = getDiceSum(roll);
                if (sumDice >=  20) { specialRow += '<b>Critical!</b>';        } else
                if (sumDice === 19) { specialRow += '<b>Near Perfect</b>';     } else
                if (sumDice === 1)  { specialRow += '<b>Potential Fumble</b>'; }

                content = `${weaponRow}<br>${speedRow}<br>${rangeRow}<br>${specialRow}<br>${content}`;
                return {content};
            }

            case 'atk': {
                const flavor = `${game.i18n.localize('HM.melee')}
                                ${game.i18n.localize('HM.attack')}
                                ${game.i18n.localize('HM.roll')}`;
                let content = await roll.render({flavor});

                const weaponRow = `${game.i18n.localize('HM.weapon')}:
                                <b>${item.name}</b>`;
                const speedRow  = `${game.i18n.localize('HM.speed')}:
                                <b>${item.data.data.bonus.total.spd}</b>`;

                let specialRow = '';
                const sumDice = getDiceSum(roll);
                if (sumDice >=  20) { specialRow += '<b>Critical!</b>';        } else
                if (sumDice === 19) { specialRow += '<b>Near Perfect</b>';     } else
                if (sumDice === 1)  { specialRow += '<b>Potential Fumble</b>'; }

                content = `${weaponRow}<br>${speedRow}<br>${specialRow}<br>${content}`;
                return {content};
            }

            case 'dmg': {
                let flavor =    `${game.i18n.localize('HM.damage')}
                                 ${game.i18n.localize('HM.roll')}`;
                if (dialogResp.resp.shieldhit) {
                    flavor += ` (${game.i18n.localize('HM.blocked')})`;
                }

                let content = await roll.render({flavor});

                const weaponRow = `${game.i18n.localize('HM.weapon')}:
                                <b>${item.name}</b>`;

                content = `${weaponRow}<p>${content}`;
                return {content};
            }

            case 'def': {
                const flavor = `${game.i18n.localize('HM.defense')}
                                ${game.i18n.localize('HM.roll')}`;
                let content = await roll.render({flavor});

                const weaponRow = `${game.i18n.localize('HM.weapon')}:
                                <b>${item.name}</b>`;

                let specialRow = '';
                const sumDice = getDiceSum(roll);
                if (sumDice >=  20) { specialRow += '<b>Perfect!</b>';     } else
                if (sumDice === 19) { specialRow += '<b>Near Perfect</b>'; } else
                if (sumDice === 18) { specialRow += '<b>Superior</b>';     } else
                if (sumDice === 1)  { specialRow += '<b>Fumble</b>';       }

                const faShield = '<i class="fas fa-shield-alt"></i>';
                const dr = caller.drObj;
                const drRow = `DR: <b>${dr.armor} + ${faShield}${dr.shield}</b>`;
                content = `${weaponRow}<br>${drRow}<br>${specialRow}<br>${content}`;
                return {content};
            }
            default:
        }
    }

    async _createSkillCard(roll, dataset, dialogResp) {
        const item = dialogResp.context;
        const {data} = item.data;
        const {skillType} = dataset;
        const {rollMode} = dialogResp.resp;

        let skillname = game.i18n.localize(item.name);
        if (data.specialty.checked && data.specialty.value) {
            skillname += ` (${data.specialty.value})`;
        }

        let flavor = `${skillname}
                      ${game.i18n.localize(`HM.${skillType}`)}
                      ${game.i18n.localize('HM.check')}`;

        if (dialogResp.resp.opposed) flavor = `${game.i18n.localize('HM.opposed')} ${flavor}`;
        let content = await roll.render({flavor});

        if (!dialogResp.resp.opposed) {
            const {difficulty} = HMTABLES.skill;
            for (const key in difficulty) {
                if (roll.total + difficulty[key] > 0) continue;
                content = `${game.i18n.localize(key)} ${game.i18n.localize('HM.success')} <p>${content}`;
                break;
            }
        }
        return {content, rollMode};
    }

    async _createSpellCard(_dataset, dialogResp) {
        const {caller} = dialogResp;
        const item     = dialogResp.context;
        const {data}   = item.data;

        // Spell Components
        const components = [];
        if (data.component.verbal)   { components.push('V');  }
        if (data.component.somatic)  { components.push('S');  }
        if (data.component.material) { components.push('M');  }
        if (data.component.catalyst) { components.push('C');  }
        if (data.component.divine)   { components.push('DI'); }
        dialogResp.resp.components = components.join(', ');

        if (data.divine) {
            const prepped = Math.max(data.prepped - 1, 0);
            await item.update({'data.prepped': prepped});
        } else {
            // Spell Point Calculation
            let base = 30 + 10 * data.lidx;
            if (data.prepped < 1) { base *= 2; }
            const schedule = Math.max(0, dialogResp.resp.mod || 0);
            const sum = base + schedule;
            dialogResp.resp.sp = {value: sum, base, schedule};
            const spNew = caller.data.data.sp.value - sum;
            await caller.update({'data.sp.value': spNew});
        }

        const template = 'systems/hackmaster5e/templates/chat/spell.hbs';
        const content = await renderTemplate(template, dialogResp);
        return {content};
    }
}
