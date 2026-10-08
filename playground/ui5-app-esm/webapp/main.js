import "./util/Helper.js";
import "./controller/App.controller.js";
import Component from "./Component.js";
import ComponentContainer from "sap/ui/core/ComponentContainer";

const component = await new Component({ id: "todo" });
new ComponentContainer({ component }).placeAt("container");
