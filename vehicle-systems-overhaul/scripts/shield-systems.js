const SHIELD_RESULT = Symbol("shieldResult");
const SHIELD_APPLICATION = Symbol("shieldApplication");
const SHIELD_LABEL = `${MODULE_ID}.shield-overlay`;

Hooks.once("init", () => {
  CONFIG.DND5E.damageTypes.shieldMax = {
    label: "Maximum Shield Points",
    isPhysical: false
  };
  CONFIG.DND5E.healingTypes.shieldHealing = {
    label: "Shield Points"
  };
  CONFIG.DND5E.healingTypes.shieldMaxHealing = {
    label: "Maximum Shield Points"
  };
});

function hasShields(actor) {
  return actor?.getFlag(MODULE_ID, "shields.enabled") === true;
}

function getShields(actor) {
  return Math.max(0, Number(actor?.getFlag(MODULE_ID, "shields.value")) || 0);
}

function getShieldsMax(actor) {
  return Math.max(0, Number(actor?.getFlag(MODULE_ID, "shields.max")) || 0);
}

class ShieldSystemConfig extends dnd5e.applications.actor.BaseConfigSheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ["shield-systems", "vehicle-systems-overhaul-shields-config"],
    position: { width: 420 }
  };
  static PARTS = {
    config: {
      template: `modules/${MODULE_ID}/templates/shield-systems-config.hbs`
    }
  };
  
  get title() {
    return "Shields";
  }
  
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.shields = { 
      enabled: hasShields(this.document), 
      value: getShields(this.document), 
      max: getShieldsMax(this.document) 
    };
    return context;
  }
  
  async _processSubmitData(event, form, formData) {
    const fields = new FormData(form);
    const prefix = `flags.${MODULE_ID}.shields.`;
    const numeric = (field, fallback) => {
      const input = fields.get(prefix + field);
      const value = input === null ? fallback : Number(input);
      return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
    };
    const max = numeric("max", getShieldsMax(this.document));
    const value = Math.min(max, numeric("value", getShields(this.document)));
    const enabled = fields.has(prefix + "enabled");

    await this.document.update({
      [prefix + "enabled"]: enabled,
      [prefix + "max"]: max,
      [prefix + "value"]: value
    });
  }
}

function getActivityApplicationActor(application) {
  const document = application?.document ?? application?.object;
  return document?.actor
    ?? document?.parent?.actor
    ?? (document?.parent?.type ? document.parent : null)
    ?? application?.activity?.actor
    ?? application?.item?.actor
    ?? null;
}

Hooks.on("renderApplicationV2", (app, element) => {
  //Get Actor and determine if the actor is a vehicle. Short circuit if not.
  const root = element instanceof HTMLElement ? element : element?.[0];
  if (!root) return;
  filterVehicleResourceActivityTypes(app, root);
  const actor = app.document ?? app.actor;  
  if (actor?.type !== "vehicle") return;
  const sidebar = element.querySelector(".sheet-sidebar");
  if (!sidebar) return;
  const hitPointsLabel = game.i18n.localize("DND5E.HitPoints");  
  const hitPointsRow = [...sidebar.querySelectorAll(".pills-group")].find(row =>
    row.querySelector("h3 .roboto-upper")?.textContent.trim() === hitPointsLabel
  );
  if (!hitPointsRow) return;
  const editMode = element.querySelector('.slide-toggle input[type="checkbox"]')?.checked === true;
  renderVehicleShieldFields(actor, hitPointsRow, editMode);
});


function renderVehicleShieldFields(actor, hpRow, editMode) {
  const shieldsValue = getShields(actor);
  const shieldsMax = getShieldsMax(actor);
  const shieldsRow = document.createElement("div");
  shieldsRow.className = "pills-group empty vehicle-systems-overhaul-shields";

  if (editMode) {
    shieldsRow.innerHTML = `
      <h3 class="icon">
        <i class="fa-solid fa-shield-halved fa-fw" inert></i>
        <span class="roboto-upper">Shields</span>
        <button type="button" class="config-button unbutton vehicle-systems-overhaul-shields-config-button"
                data-tooltip aria-label="Configure Shields">
          <i class="fa-solid fa-cog" inert></i>
        </button>
      </h3>`;
  } else {
    shieldsRow.innerHTML = `
      <h3 class="icon vehicle-systems-overhaul-shields-inline">
        <i class="fa-solid fa-shield-halved fa-fw" inert></i>
        <span class="roboto-upper">Shields</span>
        <span class="counter display">${shieldsValue} &sol; ${shieldsMax}</span>
        <input type="text" class="value uninput vehicle-systems-overhaul-shields-value"
               placeholder="0" pattern="^[+=\\-]?\\d*" value="${shieldsValue}"
               inputmode="numeric" aria-label="Current Shields" hidden>
      </h3>`;
  }

  if (editMode || hasShields(actor)) {
    hpRow.insertAdjacentElement("afterend", shieldsRow);
  }

  if (editMode) {
  
    shieldsRow.querySelector(".vehicle-systems-overhaul-shields-config-button")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      new ShieldSystemConfig({ document: actor }).render({ force: true });
    });
  } else {
      const shieldsHeading = shieldsRow.querySelector(".vehicle-systems-overhaul-shields-inline");
      const shieldsDisplay = shieldsHeading?.querySelector(".display");
      const shieldsInput = shieldsHeading?.querySelector("input");

    if (shieldsHeading && shieldsDisplay && shieldsInput) {
      shieldsHeading.addEventListener("click", event => {
        if (event.target.closest("input")) return;
        shieldsDisplay.hidden = true;
        shieldsInput.hidden = false;
        shieldsInput.focus();
        shieldsInput.select();
      });

      const finishShieldsEdit = async () => {
        if (shieldsInput.hidden) return;
        let next = Number(String(shieldsInput.value ?? "").trim());
        const current = getShields(actor);
        if (!Number.isFinite(next)) next = current;
        const maximum = getShieldsMax(actor);
        next = Math.clamp(next, 0, maximum);
        await actor.update({ [`flags.${MODULE_ID}.shields.value`]: next });
        const saved = getShields(actor);
        shieldsInput.value = String(saved);
        shieldsDisplay.textContent = `${saved} / ${getShieldsMax(actor)}`;
        shieldsInput.hidden = true;
        shieldsDisplay.hidden = false;
      };

      shieldsInput.addEventListener("blur", finishShieldsEdit);
      shieldsInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          shieldsInput.blur();
        } else if (event.key === "Escape") {
          shieldsInput.value = String(getShields(actor));
          shieldsInput.hidden = true;
          shieldsDisplay.hidden = false;
        }
      });
    }
  }
}

function getShieldTextColor(resource, delta) {
  if (resource === "shields") {
    return CONFIG.DND5E.tokenHPColors[delta > 0 ? "healing" : "damage"];
  }
  return 0xffffff;
}

async function showShieldsDelta(actor, resource, previous, current) {
  const delta = Number(current) - Number(previous);
  if (!Number.isFinite(delta) || delta === 0 || !canvas?.ready) return;

  const tokens = canvas.tokens?.placeables?.filter(t =>
    t.actor === actor || t.actor?.uuid === actor.uuid || t.document?.actorId === actor.id
  ) ?? [];

  const maximum = getShieldsMax(actor);
  const pct = maximum > 0 ? Math.clamp(Math.abs(delta) / maximum, 0, 1) : 0;
  for (const token of tokens) {
    canvas.interface.createScrollingText(token.center, `${delta > 0 ? "+" : ""}${delta}`, {
      anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
      fontSize: 16 + (32 * pct),
      fill: getShieldTextColor(resource, delta),
      stroke: 0x000000,
      strokeThickness: 4,
      jitter: 0.25
    });
  }
}

Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
  if (actor?.type !== "vehicle") return;
  const deltas = {};
  const next = getChangedFlagValue(changes, "shields", "value");
  
  if (next !== undefined){ 
    const previous = getShields(actor);
    if (previous !== next) deltas["shields"] = { previous, next };
  }
  if (Object.keys(deltas).length) options.shieldDeltas = deltas;
});

Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if (actor?.type !== "vehicle") return;
  for (const [resource, delta] of Object.entries(options?.shieldDeltas ?? {})) {
    await showShieldsDelta(actor, resource, delta.previous, delta.next);
  }
});

function getChangedFlagValue(changes, resource, field) {
  const nested = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${resource}.${field}`);
  return nested === undefined ? undefined : Number(nested);
}


Hooks.on("dnd5e.preCalculateDamage", (actor, damages, options) => {
  if (actor?.type !== "vehicle") return;

  delete options[SHIELD_RESULT];
  delete options[SHIELD_APPLICATION];
  
  if (hasShields(actor)) {
    let valueDelta = 0;
    let maxDelta = 0;

    for (const damage of damages) {
      const value = Number(damage?.value);
      if (!Number.isFinite(value) || value === 0) continue;

      switch (damage?.type) {
        case "shieldsMax":
          maxDelta -= value;
          damage.value = 0;
          break;
        case "shieldsHealing":
          valueDelta += value;
          damage.value = 0;
          break;
        case "shieldsMaxHealing":
          maxDelta += value;
          damage.value = 0;
          break;
      }
    }

    if (valueDelta || maxDelta) {
      options[SHIELD_APPLICATION] = { valueDelta, maxDelta };
    }
  }

  if (!hasShields(actor)) return;

  let remainingShields = getShields(actor);
  if (remainingShields <= 0) return;

  let absorbed = 0;

  for (const damage of damages) {
    if (remainingShields <= 0) break;

    const value = Number(damage?.value);
    if (!Number.isFinite(value) || value <= 0) continue;

    const type = damage?.type;
    const isConfiguredDamage =
      type != null &&
      Object.prototype.hasOwnProperty.call(CONFIG.DND5E.damageTypes, type);

    const isUntypedDamage = type === undefined;
    if (!isConfiguredDamage && !isUntypedDamage) continue;

    const blocked = Math.min(value, remainingShields);
    damage.value = value - blocked;
    remainingShields -= blocked;
    absorbed += blocked;
  }

  if (absorbed > 0) options[SHIELD_RESULT] = { absorbed };
});

function getHPBarIndex(token) {
  if (token?.document?.bar1?.attribute === "attributes.hp") return 0;
  if (token?.document?.bar2?.attribute === "attributes.hp") return 1;
  return null;
}

function drawVehicleShieldsOverlay(token) {
  removeShieldOverlay(token);
  
  const actor = token?.actor;
  if (actor?.type !== "vehicle" || !hasShields(actor)) return;

  const shields = getShields(actor);
  if (shields <= 0) return;

  const shieldsMax = getShieldsMax(actor);
  if (shieldsMax <= 0) return;

  const barIndex = getHPBarIndex(token);
  if (barIndex === null) return;

  const hpBar = token?.bars?.children?.[barIndex];
  if (!hpBar) return;

  const bounds = hpBar.getLocalBounds();
  if (!(bounds.width > 0) || !(bounds.height > 0)) return;
  
  const fraction = Math.clamp(shields / shieldsMax, 0, 1);
  if (fraction <= 0) return;

  const width = bounds.width * fraction;
  
  const x = bounds.x;

  const y = bounds.y - 1;
  
  const height = bounds.height + 2;

  const overlay = new PIXI.Graphics();
  overlay.label = SHIELD_LABEL;
  overlay.eventMode = "none";

  overlay.beginFill(0x9b5de5, 0.72);
  overlay.drawRect(x, y, width, height);
  overlay.endFill();

  hpBar.addChild(overlay);
}

Hooks.on("dnd5e.preApplyDamage", (actor, amount, updates, options) => {
  if (actor?.type !== "vehicle" || !hasShields(actor)) return;

  let shieldsValue = getShields(actor);
  let shieldsMax = getShieldsMax(actor);
  let changed = false;

  const application = options?.[SHIELD_APPLICATION];
  if (application) {
    shieldsMax = Math.max(0, shieldsMax + Number(application.maxDelta || 0));
    shieldsValue = Math.clamp(
      shieldsValue + Number(application.valueDelta || 0),
      0,
      shieldsMax
    );
    changed = true;
    delete options[SHIELD_APPLICATION];
  }

  const result = options?.[SHIELD_RESULT];
  if (result?.absorbed) {
    shieldsValue = Math.max(shieldsValue - Number(result.absorbed), 0);
    changed = true;
    delete options[SHIELD_RESULT];
  }

  if (!changed) return;

  updates[`flags.${MODULE_ID}.shields.max`] = shieldsMax;
  updates[`flags.${MODULE_ID}.shields.value`] = shieldsValue;
});
Hooks.on("drawToken", token => drawVehicleShieldsOverlay(token));
Hooks.on("refreshToken", token => drawVehicleShieldsOverlay(token));

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  if (!module) return;

  module.api ??= {};
  Object.assign(module.api, {
    modifyShields: (actor, amount) => modifyVehicleResource(actor, "shields", amount),
    rollShields: (actor, formula, options) => rollVehicleResource(actor, "shields", formula, options),

    hasShields,
    getShields,
    getShieldsMax,

    async setShieldsEnabled(actor, enabled) {
      if (!actor) throw new Error("No Actor supplied.");
      if (actor?.type !== "vehicle") throw new Error("Actor is not a vehicle.");
      return actor.update({ [`flags.${MODULE_ID}.shields.enabled`]: Boolean(enabled) });
    },

    async setShields(actor, value, max = undefined) {
      if (!actor) throw new Error("No Actor supplied.");
      if (actor?.type !== "vehicle") throw new Error("Actor is not a vehicle.");

      const finalMax = max !== undefined
        ? Math.max(0, Number(max) || 0)
        : getShieldsMax(actor);
      const finalValue = Math.clamp(Number(value) || 0, 0, finalMax);

      const updates = {
        [`flags.${MODULE_ID}.shields.value`]: finalValue
      };

      if (max !== undefined) {
        updates[`flags.${MODULE_ID}.shields.max`] = finalMax;
      }

      return actor.update(updates);
    },

    async restoreShields(actor) {
      if (!actor) throw new Error("No Actor supplied.");
      if (actor?.type !== "vehicle") throw new Error("Actor is not a vehicle.");

      return actor.update({
        [`flags.${MODULE_ID}.shields.value`]: getShieldsMax(actor)
      });
    },
    redraw(token) {
      drawVehicleShieldsOverlay(token);
    }
  });
});

async function rollVehicleResource(actor, resource, formula, { operation="add", label=null }={}) {
  if (!actor) throw new Error("No Actor supplied.");
  if (actor?.type !== "vehicle") throw new Error("Actor is not a vehicle.");

  const roll = await (new Roll(String(formula), actor.getRollData())).evaluate();
  const total = Number(roll.total) || 0;

  let delta;
  switch (operation) {
    case "restore": delta = Math.abs(total); break;
    case "drain": delta = -Math.abs(total); break;
    case "add": delta = total; break;
    case "remove": delta = -total; break;
    default: throw new Error(`Unknown resource operation: ${operation}`);
  }

  await modifyVehicleResource(actor, resource, delta);

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: label ?? `${"Shields"}: ${operation}`
  });

  return roll;
}

async function modifyVehicleResource(actor, resource, amount) {
  if (!actor) throw new Error("No Actor supplied.");
  if (actor?.type !== "vehicle") throw new Error("Actor is not a vehicle.");

  const delta = Number(amount);
  if (!Number.isFinite(delta)) throw new Error("Resource change must be numeric.");

  if (resource === "shields") {
    if (!hasShields(actor)) return actor;
    const max = getShieldsMax(actor);
    const value = Math.clamp(getShields(actor) + delta, 0, max);
    return actor.update({ [`flags.${MODULE_ID}.shields.value`]: value });
  }

  throw new Error(`Unknown resource: ${resource}`);
}
function removeShieldOverlay(token) {
  for (const bar of token?.bars?.children ?? []) {
    for (const child of [...(bar.children ?? [])]) {
      if (child.label !== SHIELD_LABEL) continue;
      bar.removeChild(child);
      child.destroy();
    }
  }
}
function filterVehicleResourceActivityTypes(application, root) {
  const actor = getActivityApplicationActor(application);

  const customValues = new Set([
    "shieldsMax",
    "shieldsHealing",
    "shieldsMaxHealing"
  ]);
  const matching = Array.from(root.querySelectorAll("select")).filter(select =>
    Array.from(select.options).some(option => customValues.has(option.value))
  );
  if (!matching.length) return;

  if (actor?.type !== "vehicle") {
    for (const select of matching) {
      for (const option of Array.from(select.options)) {
        if (customValues.has(option.value)) option.remove();
      }
    }
    return;
  }

  reorderDamageActivityShieldTypes(root);
}

function reorderDamageActivityShieldTypes(root) {
  for (const select of root.querySelectorAll("select")) {
    const shieldsMax = select.querySelector('option[value="shieldsMax"]');
    if (!shieldsMax) continue;

    const options = Array.from(select.options);
    const maxHp = options.find(option =>
      option.textContent?.trim() === "Maximum Hit Points"
    );

    shieldsMax.remove();

    if (maxHp) {
      maxHp.after(shieldsMax);
    } else {
      select.append(shieldsMax);
    }
  }
}