const Helper = {
  resolvePath(sPath) {
    return new URL(sPath, new URL("../", import.meta.url)).toString();
  },
};

sap.ui.define("sap/ui/demo/todo/util/Helper", [], () => Helper);

export default Helper;
