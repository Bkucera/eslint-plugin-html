"use strict";

var extract = require("./extract");
var linter = require("eslint").linter;

var htmlExtensions = [
  ".erb",
  ".handelbars",
  ".hbs",
  ".htm",
  ".html",
  ".mustache",
  ".php",
  ".tag",
  ".twig",
  ".vue",
  ".we",
];

var xmlExtensions = [
  ".xhtml",
  ".xml",
];

// Disclaimer:
//
// This is not a long term viable solution. ESLint needs to improve its processor API to
// provide access to the configuration before actually preprocess files, but it's not
// planed yet. This solution is quite ugly but shouldn't alter eslint process.
//
// Related github issues:
// https://github.com/eslint/eslint/issues/3422
// https://github.com/eslint/eslint/issues/4153

function createProcessor(defaultXMLMode) {
  var verify = linter.verify;
  var reportBadIndent;

  var currentInfos;

  function patch() {
    linter.verify = function (textOrSourceCode, config, filenameOrOptions, saveState) {
      var indentDescriptor = config.settings && config.settings["html/indent"];
      var xmlMode = config.settings && config.settings["html/xml-mode"];
      reportBadIndent = config.settings && config.settings["html/report-bad-indent"];

      if (typeof xmlMode !== "boolean") {
        xmlMode = defaultXMLMode;
      }

      currentInfos = extract(textOrSourceCode, {
        indent: indentDescriptor,
        reportBadIndent: Boolean(reportBadIndent),
        xmlMode: xmlMode,
      });
      return verify.call(this, currentInfos.code, config, filenameOrOptions, saveState);
    };
  }

  function unpatch() {
    linter.verify = verify;
  }
  return {

    preprocess: function (content) {
      patch();
      return [content];
    },

    postprocess: function (messages) {
      unpatch();

      messages[0].forEach(function (message) {
        message.column += currentInfos.map[message.line] || 0;
      });

      currentInfos.badIndentationLines.forEach(function (line) {
        messages[0].push({
          message: "Bad line indentation.",
          line: line,
          column: 1,
          ruleId: "(html plugin)",
          severity: reportBadIndent === true ? 2 : reportBadIndent,
        });
      });

      messages[0].sort(function (ma, mb) {
        return ma.line - mb.line || ma.column - mb.column;
      });

      return messages[0];
    },

  };

}

var htmlProcessor = createProcessor(false);
var xmlProcessor = createProcessor(true);

var processors = {};

htmlExtensions.forEach(function(ext) {
  processors[ext] = htmlProcessor;
});

xmlExtensions.forEach(function(ext) {
  processors[ext] = xmlProcessor;
});

exports.processors = processors;
