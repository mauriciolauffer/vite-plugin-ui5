import UIComponent from "sap/ui/core/UIComponent";

const Component = UIComponent.extend("sap.ui.demo.todo.Component", {
  metadata: {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"],
  },
});

export default Component;
