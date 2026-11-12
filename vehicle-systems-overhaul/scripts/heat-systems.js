const MODULE_ID = "vehicle-systems-overhaul";

function hasHeat(actor) {
  return actor?.getFlag(MODULE_ID, "heat.enabled") === true;
}

function getHeat(actor) {
  return Math.max(0, Number(actor?.getFlag(MODULE_ID, "heat.value")));
}

function getHeatMax(actor) {
  return Math.max(0, Number(actor?.getFlag(MODULE_ID, "heat.max")));
}

class HeatSystemConfig extends dnd5e.applications.actor.BaseConfigSheetV2 {  static DEFAULT_OPTIONS = {
    classes: ["heat-systems", "vehicle-systems-overhaul-heat-config"],
    position: { width: 420 }
  };
  static PARTS = {
    config: {
      template: `modules/${MODULE_ID}/templates/heat-systems-config.hbs`
    }
  }
  
  get title() {
    return "Heat";
  }
  
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.heat = { 
      enabled: hasHeat(this.document), 
      value: getHeat(this.document), 
      max: getHeatMax(this.document) 
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
    const max = numeric("max", getHeatMax(this.document));
    const value = Math.min(max, numeric("value", getHeat(this.document)));
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
  renderVehicleHeatFields(actor, hitPointsRow, editMode);
});


function renderVehicleHeatFields(actor, hpRow, editMode) {
  const heatValue = getHeat(actor);
  const heatMax = getHeatMax(actor);
  const heatRow = document.createElement("div");
  heatRow.className = "pills-group empty vehicle-systems-overhaul-heat";

  if (editMode) {
    heatRow.innerHTML = `
      <h3 class="icon">
        <i class="fa-solid fa-temperature-half fa-fw" inert></i>
        <span class="roboto-upper">Heat</span>
        <button type="button" class="config-button unbutton vehicle-systems-overhaul-heat-config-button"
                data-tooltip aria-label="Configure Heat">
          <i class="fa-solid fa-cog" inert></i>
        </button>
      </h3>`;
  } else {
    heatRow.innerHTML = `
      <h3 class="icon vehicle-systems-overhaul-heat-inline">
        <i class="fa-solid fa-temperature-half fa-fw" inert></i>
        <span class="roboto-upper">Heat</span>
        <span class="counter display">${heatValue} &sol; ${heatMax}</span>
        <input type="text" class="value uninput vehicle-systems-overhaul-heat-value"
               placeholder="0" pattern="^[+=\\-]?\\d*" value="${heatValue}"
               inputmode="numeric" aria-label="Current Heat" hidden>
      </h3>`;
  }

  if (editMode || hasHeat(actor)) {
    hpRow.insertAdjacentElement("afterend", heatRow);
  }

  if (editMode) {
  
    heatRow.querySelector(".vehicle-systems-overhaul-heat-config-button")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      new HeatSystemConfig({ document: actor }).render({ force: true });
    });
  } else {
    const heatHeading = heatRow.querySelector(".vehicle-systems-overhaul-heat-inline");
    const heatDisplay = heatHeading?.querySelector(".display");
    const heatInput = heatHeading?.querySelector("input");

    if (heatHeading && heatDisplay && heatInput) {
      heatHeading.addEventListener("click", event => {
        if (event.target.closest("input")) return;
        heatDisplay.hidden = true;
        heatInput.hidden = false;
        heatInput.focus();
        heatInput.select();
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

function getHeatTextColor(resource, delta) {
  if (resource === "heat") {
    return delta < 0 ? 0x3399ff : CONFIG.DND5E.tokenHPColors.damage;
  }
  return 0xffffff;
}

async function showHeatDelta(actor, resource, previous, current) {
  const delta = Number(current) - Number(previous);
  if (!Number.isFinite(delta) || delta === 0 || !canvas?.ready) return;

  const tokens = canvas.tokens?.placeables?.filter(t =>
    t.actor === actor || t.actor?.uuid === actor.uuid || t.document?.actorId === actor.id
  ) ?? [];

  const maximum = getHeatMax(actor);
  const pct = maximum > 0 ? Math.clamp(Math.abs(delta) / maximum, 0, 1) : 0;
  for (const token of tokens) {
    canvas.interface.createScrollingText(token.center, `${delta > 0 ? "+" : ""}${delta}`, {
      anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
      fontSize: 16 + (32 * pct),
      fill: getHeatTextColor(resource, delta),
      stroke: 0x000000,
      strokeThickness: 4,
      jitter: 0.25
    });
  }
}

Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
  if (actor.type !== "vehicle") return;
  const deltas = {};
  const next = getChangedFlagValue(changes, "heat", "value");
  
  if (next !== undefined){ 
    const previous = getHeat(actor);
    if (previous !== next) deltas["heat"] = { previous, next };
  }
  if (Object.keys(deltas).length) options.heatDeltas = deltas;
});

Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if (actor.type !== "vehicle" || (userId && userId !== game.user.id)) return;
  for (const [resource, delta] of Object.entries(options?.heatDeltas ?? {})) {
    await showHeatDelta(actor, resource, delta.previous, delta.next);
  }
});

function getChangedFlagValue(changes, resource, field) {
  const nested = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${resource}.${field}`);
  return nested === undefined ? undefined : Number(nested);
}