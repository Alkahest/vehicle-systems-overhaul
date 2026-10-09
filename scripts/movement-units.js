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

Hooks.on("renderApplicationV2", (application, element) => {
  updateVehicleMovementSpeedFields(application, element);
});

function updateVehicleMovementSpeedFields(application, element) {
  const sidebar = element.querySelector(".sheet-sidebar");
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
  
  if (travelPaceRow) 
    travelPaceRow.remove();
  }
}