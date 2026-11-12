Hooks.once("init", () => {
  CONFIG.DND5E.movementUnits.hex = {
    label: "Hexes",
    abbreviation: "hex",
    template: "hex",
    conversion: 1,
    counted: "MOVEMENT.UNITS.Hex",
    type: "imperial",
    travelResolution: "round"
  };
});

Hooks.on("renderApplicationV2", (app, element) => {
  updateVehicleMovementSpeedFields(app, element);
});


function updateVehicleMovementSpeedFields(app, element) {
  //Get Actor and determine if the actor is a vehicle. Short circuit if not.
  const actor = app.document ?? app.actor;
  if (actor?.documentName !== "Actor" || actor.type !== "vehicle") {
    return;
  }
  
  
  const sidebar = element.querySelector(".sheet-sidebar");
  if (!sidebar) return;
  
  const travelSpeedLabel = game.i18n.localize("DND5E.TRAVEL.Speed");  
  const travelSpeedRow = [...sidebar.querySelectorAll(".pills-group")].find(row =>
    row.querySelector("h3 .roboto-upper")?.textContent.trim() === travelSpeedLabel
  );
  
  if (travelSpeedRow) {
    travelSpeedRow.querySelector("h3 .roboto-upper").textContent = "Cruise";
    travelSpeedRow.querySelector("h3 i").className = "fas fa-car";
  }
  
  const travelPaceLabel = game.i18n.localize("DND5E.TRAVEL.Label");  
  const travelPaceRow = [...sidebar.querySelectorAll(".pills-group")].find(row =>
    row.querySelector("h3 .roboto-upper")?.textContent.trim() === travelPaceLabel
  );
  
  if (travelPaceRow) {
    travelPaceRow.remove();
  }
}