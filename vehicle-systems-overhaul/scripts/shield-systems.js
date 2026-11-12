const MODULE_ID = "vehicle-systems-overhaul";


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

export function hasShields(actor) {
  return actor?.getFlag(MODULE_ID, "shields.enabled") === true;
}

export function getShields(actor) {
  return Math.max(0, Number(actor?.getFlag(MODULE_ID, "shields.value")) || 0);
}

export function getShieldsMax(actor) {
  return Math.max(0, Number(actor?.getFlag(MODULE_ID, "shields.max")) || 0);
}

class ShieldSystemConfig extends dnd5e.applications.actor.BaseConfigSheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ["shield-points", "vehicle-systems-overhaul-shield-config"],
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
    context.shield = { 
      enabled: hasShields(this.document), 
      value: getShields(this.document), 
      max: getShieldsMax(this.document) 
    };
    return context;
  }
  
  
  async _processSubmitData(event, form, formData) {
    const fields = new FormData(form);
    const prefix = `flags.${MODULE_ID}.heat.`;
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

Hooks.on("renderApplicationV2", (app, element) => {
  //Get Actor and determine if the actor is a vehicle. Short circuit if not.
  const actor = app.document ?? app.actor;
  if (actor?.documentName !== "Actor" || actor.type !== "vehicle") {
    return;
  }
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
      const heading = group.querySelector(".vehicle-systems-overhaul-shield-inline");
      const shieldDisplay = heading?.querySelector(".display");
      const shieldInput = heading?.querySelector("input");

    if (heading && shieldDisplay && shieldInput) {
      heading.addEventListener("click", event => {
        if (event.target.closest("input")) return;
        shieldDisplay.hidden = true;
        shieldInput.hidden = false;
        shieldInput.focus();
        shieldInput.select();
      });

      const finishHeatEdit = async () => {
        if (heatInput.hidden) return;
        let next = Number(String(heatInput.value ?? "").trim());
        const current = getHeat(actor);
        if (!Number.isFinite(next)) next = current;
        const maximum = getHeatMax(actor);
        next = Math.clamp(next, 0, maximum);
        await actor.update({ [`flags.${MODULE_ID}.heat.value`]: next });
        const saved = getHeat(actor);
        heatInput.value = String(saved);
        heatDisplay.textContent = `${saved} / ${getHeatMax(actor)}`;
        heatInput.hidden = true;
        heatDisplay.hidden = false;
      };

      heatInput.addEventListener("blur", finishHeatEdit);
      heatInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          heatInput.blur();
        } else if (event.key === "Escape") {
          heatInput.value = String(getHeat(actor));
          heatInput.hidden = true;
          heatDisplay.hidden = false;
        }
      });
    }
  }
}

function getShieldTextColor(resource, delta) {
  if (resource === "shield") {
    return CONFIG.DND5E.tokenHPColors[delta > 0 ? "healing" : "damage"];
  }
  return 0xffffff;
}

async function showShieldDelta(actor, resource, previous, current) {
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
  if (actor.type !== "vehicle") return;
  const deltas = {};
  const next = getChangedFlagValue(changes, "shield", "value");
  
  if (next !== undefined){ 
    const previous = getShields(actor);
    if (previous !== next) deltas["shield"] = { previous, next };
  }
  if (Object.keys(deltas).length) options.shieldDeltas = deltas;
});

Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if (actor.type !== "vehicle") return;
  for (const [resource, delta] of Object.entries(options?.shieldDeltas ?? {})) {
    await showShieldDelta(actor, resource, delta.previous, delta.next);
  }
});

function getChangedFlagValue(changes, resource, field) {
  const nested = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${resource}.${field}`);
  return nested === undefined ? undefined : Number(nested);
}