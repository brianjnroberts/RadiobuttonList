/*jslint browser: true, devel:true, nomen:true, unparam:true, regexp: true, plusplus:true*/
/*global require, define, logger, mx, mendix*/
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",
    "mxui/dom",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/dom-attr",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/html",
    "dojo/aspect",
    "dojo/text!RadioButtonList/widget/template/RadioButtonList.html"
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoClass, dojoStyle, dojoConstruct, dojoAttr, dojoArray, lang, dojoHtml, aspect, widgetTemplate) {
    "use strict";

    // Declare widget's prototype.
    return declare("RadioButtonList.widget.AttrRadioButtonList", [_WidgetBase, _TemplatedMixin], {

        templateString: widgetTemplate,

        // DOM elements
        inputNodes: null,

        // Parameters configurable in Business Modeler.
        entity: null,
        direction: "vertical",
        captiontrue: "",
        captionfalse: "",
        readonly: false,
        onchangeAction: "",
        allowDeselect: false,
        formOrientation: null,
        onchangeNanoflow: null,

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
        _alertDiv: null,
        _radioButtonOptions: null,
        _setup: false,

        constructor: function () {
            this._handles = [];
        },

        postCreate: function () {
            logger.debug(this.id + ".postCreate");
        },

        update: function (obj, callback) {
            logger.debug(this.id + ".update");
            this._contextObj = obj;
            this._resetSubscriptions();
            this._setRadiobuttonOptions();

            if (!this._setup) {
                this._setupWidget(lang.hitch(this, function () {
                    this._updateRendering(callback);
                }));
            } else {
                this._updateRendering(callback);
            }
        },

        _setupWidget: function (callback) {
            logger.debug(this.id + "._setupWidget");

            if (this.readOnly || this.get("disabled") || this.readonly) {
                //this.readOnly isn"t available in client API, this.get("disabled") works correctly since 5.18.
                this._isReadOnly = true;
            }

            // adjust the template based on the display settings.
            if (this.showLabel) {
                if (dojoClass.contains(this.radioButtonLabel, "hidden")) {
                    dojoClass.remove(this.radioButtonLabel, "hidden");
                }

                if (this.formOrientation === "horizontal") {
                    // width needs to be between 1 and 11
                    var labelWidth = this.labelWidth < 1 ? 1 : this.labelWidth;
                    labelWidth = this.labelWidth > 11 ? 11 : this.labelWidth;

                    var controlWidth = 12 - labelWidth,
                        comboLabelClass = "col-sm-" + labelWidth,
                        comboControlClass = "hasLabel col-sm-" + controlWidth;

                    dojoClass.add(this.radioButtonLabel, comboLabelClass);
                    dojoClass.add(this.inputNodes, comboControlClass);
                }

                this.radioButtonLabel.innerHTML = this.fieldCaption;
            } else {
                if (!dojoClass.contains(this.radioButtonLabel, "hidden")) {
                    dojoClass.add(this.radioButtonLabel, "hidden");
                }
            }
            this._setup = true;

            this._executeCallback(callback, "_setupWidget");
        },

        resize: function (box) { },

        uninitialize: function () {
            if (this._handles) {
                dojoArray.forEach(this._handles, function (handle, i) {
                    mx.data.unsubscribe(handle);
                });
                this._handles = [];
            }
        },

        _updateRendering: function (callback) {
            logger.debug(this.id + "._updateRendering");

            if (this._contextObj !== null) {
                dojoStyle.set(this.domNode, "display", "block");
                this._createRadiobuttonNodes(callback);
            } else {
                dojoStyle.set(this.domNode, "display", "none");
                this._executeCallback(callback, " _updateRendering no contextObj");
            }

            // Important to clear all validations!
            this._clearValidations();
        },

        _handleValidation: function (validations) {
            logger.debug(this.id + "._handleValidation");
            this._clearValidations();

            var validation = validations[0],
                message = validation.getReasonByAttribute(this.entity);

            if (this._isReadOnly ||
                this._contextObj.isReadonlyAttr(this.entity)) {
                validation.removeAttribute(this.entity);
            } else if (typeof message != "undefined") {
                if (message) {
                    this._addValidation(message);
                    validation.removeAttribute(this.entity);
                } else {
                    this._addValidation(null);
                    validation.removeAttribute(this.entity);
                }
            }
        },

        _clearValidations: function () {
            logger.debug(this.id + "._clearValidations");
            dojoConstruct.destroy(this._alertDiv);
            this._alertDiv = null;
            var rbl = document.getElementById(this.id);
            if (rbl != null) {
                if (rbl.classList.contains("has-error")) {
                    dojoClass.remove(this.id, "has-error");
                }
            }
        },

        _showError: function (message) {
            logger.debug(this.id + "._showError");
            dojoClass.add(this.id, "has-error");
            if (message != null) {
                if (this._alertDiv !== null) {
                    dojoHtml.set(this._alertDiv, message);
                    return true;
                }
                this._alertDiv = dojoConstruct.create("div", {
                    "class": "text-danger",
                    "innerHTML": message
                });
                dojoConstruct.place(this._alertDiv, this.inputNodes);
            }
        },

        _addValidation: function (message) {
            logger.debug(this.id + "._addValidation");
            this._showError(message);
        },

        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");
            var validationHandle = null,
                objectHandle = null,
                attrHandle = null;

            // Release handles on previous object, if any.
            this.unsubscribeAll();

            // When a mendix object exists create subscribtions.
            if (this._contextObj) {
                this.subscribe({
                    guid: this._contextObj.getGuid(),
                    val: true,
                    callback: lang.hitch(this, this._handleValidation)
                });

                this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: lang.hitch(this, function (guid) {
                        this._updateRendering();
                    })
                });

                this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this.entity,
                    callback: lang.hitch(this, function (guid, attr, attrValue) {
                        this._updateRendering();
                    })
                });
            }
        },

        _setRadiobuttonOptions: function () {
            logger.debug(this.id + "._setRadiobuttonOptions");
            if (this.entity !== "" && this._contextObj) {
                //get enumeration for current attribute
                if (this._contextObj.getAttributeType(this.entity) === "Enum") {
                    this._radioButtonOptions = this._contextObj.getEnumKVPairs(this.entity);
                } else if (this._contextObj.getAttributeType(this.entity) === "Boolean") {
                    this._radioButtonOptions = {};
                    this._radioButtonOptions["true"] = this.captiontrue;
                    this._radioButtonOptions["false"] = this.captionfalse;
                }
            }
        },

        _createRadiobuttonNodes: function (callback) {
            logger.debug(this.id + "._createRadiobuttonNode");
            var labelNode = null,
                radioButtonNode = null,
                i = 0,
                nodelength = null,
                enclosingDivElement = null;

            nodelength = this.inputNodes.children ? this.inputNodes.children.length : 0;

            if (this.direction === "horizontal") {
                dojoConstruct.empty(this.inputNodes);
            }

            for (var option in this._radioButtonOptions) {
                if (this._radioButtonOptions.hasOwnProperty(option)) {

                    labelNode = this._createLabelNode(option, this._radioButtonOptions[option]);
                    radioButtonNode = this._createRadiobuttonNode(option, this._radioButtonOptions[option]);

                    dojoConstruct.place(radioButtonNode, labelNode, "first");

                    if (this.direction === "horizontal") {
                        dojoConstruct.place(labelNode, this.inputNodes, "last");
                    } else {
                        //an enclosing div element is required to vertically align a radiobuttonlist in bootstrap.
                        if (this.inputNodes.children && this.inputNodes.children[i]) {
                            enclosingDivElement = this.inputNodes.children[i];
                        } else {
                            enclosingDivElement = dojoConstruct.create("div", {
                                "class": "radio"
                            });
                        }
                        if (enclosingDivElement.children[0]) {
                            dojoConstruct.destroy(enclosingDivElement.children[0]);
                        }

                        dojoConstruct.place(labelNode, enclosingDivElement, "only");
                        if (!this.inputNodes.children[i]) {
                            dojoConstruct.place(enclosingDivElement, this.inputNodes, "last");
                        }
                    }

                    i++;
                }
            }

            this._executeCallback(callback, "_createRadiobuttonNodes");
        },

        _createLabelNode: function (key, value) {
            logger.debug(this.id + "._createLabelNode");
            var labelNode = null;

            labelNode = dojoConstruct.create("label");

            if (this._isReadOnly ||
                this._contextObj.isReadonlyAttr(this.entity)) {
                dojoAttr.set(labelNode, "disabled", "disabled");
                dojoAttr.set(labelNode, "readonly", "readonly");
            }

            if ("" + this._contextObj.get(this.entity) === key) {
                dojoClass.add(labelNode, "checked");
            }

            if (this.direction === "horizontal") {
                dojoClass.add(labelNode, "radio-inline");
            }

            dojoConstruct.place(dojoConstruct.create("span", {
                "innerHTML": value
            }), labelNode);

            return labelNode;
        },

        _createRadiobuttonNode: function (key, value, index) {
            logger.debug(this.id + "._createRadiobuttonNode");
            var radiobuttonNode = null;

            radiobuttonNode = dojoConstruct.create("input", {
                "type": "radio",
                "value": key,
                "id": this.entity + "_" + this.id + "_" + index
            });

            dojoAttr.set(radiobuttonNode, "name", "radio" + this._contextObj.getGuid() + "_" + this.id);

            if (this._isReadOnly ||
                this._contextObj.isReadonlyAttr(this.entity)) {
                dojoAttr.set(radiobuttonNode, "disabled", "disabled");
                dojoAttr.set(radiobuttonNode, "readonly", "readonly");
            }

            if ("" + this._contextObj.get(this.entity) === key) {
                dojoAttr.set(radiobuttonNode, "defaultChecked", true);
            }

            this._addOnclickToRadiobuttonItem(radiobuttonNode, key);

            return radiobuttonNode;
        },

        _addOnclickToRadiobuttonItem: function (radiobuttonNode, rbvalue) {
            logger.debug(this.id + "._addOnclickToRadiobuttonItem");
            this.connect(radiobuttonNode, "onclick", lang.hitch(this, function () {

                if (this._isReadOnly ||
                    this._contextObj.isReadonlyAttr(this.entity)) {
                    return;
                }

                if ("Boolean" === this._contextObj.getAttributeType(this.entity)) {
                    rbvalue = rbvalue === "true";
                }

                if (this.allowDeselect && this._contextObj.get(this.entity) === rbvalue) {
                    dojoAttr.set(radiobuttonNode, "checked", false);
                    this._contextObj.set(this.entity, "");
                } else {
                    dojoAttr.set(radiobuttonNode, "checked", true);
                    this._contextObj.set(this.entity, rbvalue);
                }

                if (this.onchangeAction) {
                    var action = {
                        params: {
                            applyto: "selection",
                            actionname: this.onchangeAction,
                            guids: [this._contextObj.getGuid()]
                        },
                        error: lang.hitch(this, function (error) {
                            console.error(this.id + ": XAS error executing microflow; " + error.description);
                        })
                    };

                    if (!mx.version || !!mx.version && 7 > parseInt(mx.version.split(".")[0], 10)) {
                        action.store = {
                            caller: this.mxform,
                        };
                    } else {
                        action.origin = this.mxform;
                    }

                    mx.data.action(action, this);
                } else if (!this._isEmptyObject(this.onchangeNanoflow)) {
                    // execute nanoflow to clear
                    mx.data.callNanoflow({
                        nanoflow: this.onchangeNanoflow,
                        origin: this.mxform,
                        context: this.mxcontext,
                        callback: function (result) {
                        }.bind(this),
                        error: function (error) {
                            console.error(error.message);
                        }
                    });
                }
            }));
        },

        _executeCallback: function (cb, from) {
            logger.debug(this.id + "._executeCallback " + (typeof cb) + (from ? " from " + from : ""));
            if (cb && typeof cb === "function") {
                cb();
            }
        },

        _isEmptyObject: function (obj) {
            for (var key in obj) {
                if (obj.hasOwnProperty(key))
                    return false;
            }
            return true;
        },

        isValid: function () {
            this._clearValidations();
            return true;
        }
    });
});

require(["RadioButtonList/widget/AttrRadioButtonList"]);
