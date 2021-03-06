/*
 * Euskalbar - A Firefox extension for helping in Basque translations.
 * Copyright (C) 2006-2013 Euskalbar Taldea (see AUTHORS file)
 *
 * This file is part of Euskalbar.
 *
 * Euskalbar is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

var euskalbarLib = {};

(function() {

  /* Constants */

  const Cc = Components.classes;
  const Ci = Components.interfaces;

  const chromeregCID = '@mozilla.org/chrome/chrome-registry;1';
  const chromeregIID = Ci.nsIChromeRegistry;

  const resphIID = Ci.nsIResProtocolHandler;

  const feedunescapeCID = '@mozilla.org/parserutils;1';
  const feedunescapeIID = Ci.nsIParserUtils;

  const L10N_NORMAL = 0;
  const L10N_FORMATTED = 1;


  /*
   * Ajax stuff
   */

  /* A generic function for performing AJAX requests
   * It takes one argument, which is an object that contains a set of options
   * Thanks for this, John Resig.
   */
  this.ajax = function (options) {
    var status;

    // Load the options object with defaults, if no
    // values were provided by the user
    var s = {
      // The type of HTTP Request
      type: options.type || "GET",

      // The URL the request will be made to
      url: options.url || "",

      // The Content-Type of the data we're sending
      contentType: options.contentType || "application/x-www-form-urlencoded",

      // Custom MIME Type
      mimeType: options.mimeType || "",

      // Data passed to the request
      data: options.data || "",

      // How long to wait before considering the request to be a timeout
      timeout: options.timeout ||
        euskalbar.prefs.getIntPref("query.timeout") * 1000,

      // Functions to call when the request fails, succeeds,
      // or completes (either fail or succeed)
      onComplete: options.onComplete || function(){},
      onError: options.onError || function(){},
      onSuccess: options.onSuccess || function(){},

      // The data type that'll be returned from the server
      // the default is simply to determine what data was returned from the
      // server and act accordingly.
      dataType: options.dataType || ""
    };

    if (s.data && typeof s.data !== 'string') {
      s.data = this.serialize(s.data);
    }

    // If data is available, append data to url for GET requests
    if (s.data && s.type === "GET") {
      s.url += (/\?/.test(s.url) ? "&" : "?") + s.data;
    }

    // Create the request object
    var xhr = new XMLHttpRequest();

    // Open the asynchronous POST request
    xhr.open(s.type, s.url, true);

    // Set the Content-Type header if data is being sent or it's
    // explicitely overriden
    if (s.data || options.contentType) {
      xhr.setRequestHeader("Content-Type", s.contentType);
    }

    // Override MIME Type if requested to do so
    if (s.mimeType) {
      xhr.overrideMimeType(s.mimeType);
    }

    // We're going to wait for a request for the amount of seconds
    // the user has in its preferences before giving up
    var timeoutLength = s.timeout;

    // Keep track of when the request has been succesfully completed
    var requestDone = false;

    // Watch for when the state of the document gets updated
    var onreadystatechange = xhr.onreadystatechange = function (isTimeout) {
      // Wait until the data is fully loaded,
      // and make sure that the request hasn't already timed out
      if (!requestDone && xhr &&
          (xhr.readyState === 4 || isTimeout === 'timeout')) {
        requestDone = true;

        // Check the resulting status
        status = isTimeout === 'timeout' ?
                 'timeout' :
                 httpSuccess(xhr) ?
                 'success' :
                 'error';

        if (status === 'success') {

          // Execute the success callback with the data returned from the server
          s.onSuccess(httpData(xhr, s.dataType));

          // Otherwise, an error occurred, so execute the error callback
        } else {
          s.onError(status);
        }

        // Call the completion callback
        s.onComplete();

        if (isTimeout === 'timeout') {
          xhr.abort();
        }

        // Clean up after ourselves, to avoid memory leaks
        xhr = null;
      }
    };

    // Initalize a callback which will fire `timeoutLength` seconds from now,
    // cancelling the request (if it has not already occurred).
    setTimeout(function () {
      if (xhr && !requestDone) {
        onreadystatechange('timeout');
      }
    }, timeoutLength);

    // Establish the connection to the server
    xhr.send(s.type === 'POST' ? s.data : null);

    // Determine the success of the HTTP response
    function httpSuccess(r) {
      try {
        // If no server status is provided, and we're actually
        // requesting a local file, then it was successful
        return !r.status && location.protocol == "file:" ||
          // Any status in the 200 range is good
          (r.status >= 200 && r.status < 300) ||
          // Successful if the document has not been modified
          r.status == 304;
      } catch (e) {
      }

      // If checking the status failed, then assume that the request failed too
      return false;
    }

    // Extract the correct data from the HTTP response
    function httpData(r, type) {
      // Get the content-type header
      var ct = r.getResponseHeader("content-type");

      // If no default type was provided, determine if some
      // form of XML was returned from the server
      var data = !type && ct && ct.indexOf("xml") >= 0;

      // Get the XML Document object if XML was returned from
      // the server, otherwise return the text contents returned by the server
      data = type == "xml" || data ? r.responseXML : r.responseText;

      // If the specified type is "script", execute the returned text
      // response as if it was JavaScript
      if (type == "script") {
        JSON.parse(data);
      }

      // Return the response data (either an XML Document or a text string)
      return data;
    }

  };

  // Serialize an array of form elements or a set of
  // key/values into a query string
  this.serialize = function (a) {
    var s = [];

    function add(key, value) {
      // If value is a function, invoke it and return its value
      value = euskalbarLib.isFunction(value) ? value() : value;
      s[s.length] = encodeURIComponent(key) + "=" + encodeURIComponent(value);
    }

    // If an array was passed in, assume that it is an array of form elements.
    if (this.isArray(a)) {
      // Serialize the form elements
      for (var i=0; i<a.length; i++) {
        add(a[i].name, a[i].value);
      }
    } else {
      // Assume it's an object of key/value pairs
      for (var j in a) {
        add(j, a[j]);
      }
    }

    // Return the resulting serialization
    return s.join("&").replace(/%20/g, "+");
  };


  /*
   * Utils
   */
  this.isFunction = function (obj) {
    return toString.call(obj) === "[object Function]";
  };

  this.isArray = function (obj) {
    return toString.call(obj) === "[object Array]";
  };


  /*
   * DOM manipulation
   */

  /* Quick and easy getElementById */
  this.$ = function (id, doc) {
    if (doc) {
      return doc.getElementById(id);
    } else {
      return document.getElementById(id);
    }
  };


  /*
   * String manipulation
   */

  this.slugify = function (text) {
    var index = text.lastIndexOf(".");

    if (index > 0) {
      text = text.substr(index + 1);
    }

    text = text.toLowerCase();
    text = text.replace(/[^-a-z0-9,&\s]+/ig, '');
    text = text.replace(/-/gi, "_");
    text = text.replace(/\s/gi, "-")

    return text;
  };

  /*
   * Removes diacritics from strings
   */
  this.normalize = function (str) {
    var newStr = str.toLowerCase();

    newStr = newStr.replace(/á/, "a");
    newStr = newStr.replace(/à/, "a");
    newStr = newStr.replace(/ä/, "a");
    newStr = newStr.replace(/â/, "a");
    newStr = newStr.replace(/é/, "e");
    newStr = newStr.replace(/è/, "e");
    newStr = newStr.replace(/ë/, "e");
    newStr = newStr.replace(/ê/, "e");
    newStr = newStr.replace(/í/, "i");
    newStr = newStr.replace(/ì/, "i");
    newStr = newStr.replace(/ï/, "i");
    newStr = newStr.replace(/î/, "i");
    newStr = newStr.replace(/ó/, "o");
    newStr = newStr.replace(/ò/, "o");
    newStr = newStr.replace(/ö/, "o");
    newStr = newStr.replace(/ô/, "o");
    newStr = newStr.replace(/ú/, "u");
    newStr = newStr.replace(/ù/, "u");
    newStr = newStr.replace(/ü/, "u");
    newStr = newStr.replace(/û/, "u");
    newStr = newStr.replace(/Á/, "A");
    newStr = newStr.replace(/À/, "A");
    newStr = newStr.replace(/Ä/, "A");
    newStr = newStr.replace(/Â/, "A");
    newStr = newStr.replace(/É/, "E");
    newStr = newStr.replace(/È/, "E");
    newStr = newStr.replace(/Ë/, "E");
    newStr = newStr.replace(/Ê/, "E");
    newStr = newStr.replace(/Í/, "I");
    newStr = newStr.replace(/Ì/, "I");
    newStr = newStr.replace(/Ï/, "I");
    newStr = newStr.replace(/Î/, "I");
    newStr = newStr.replace(/Ó/, "O");
    newStr = newStr.replace(/Ò/, "O");
    newStr = newStr.replace(/Ö/, "O");
    newStr = newStr.replace(/Ô/, "O");
    newStr = newStr.replace(/Ú/, "U");
    newStr = newStr.replace(/Ù/, "U");
    newStr = newStr.replace(/Ü/, "U");
    newStr = newStr.replace(/Û/, "U");
    newStr = newStr.replace(/Ñ/, "N");
    newStr = newStr.replace(/ñ/, "n");

    return newStr;
  };

  /*
   * Parse HTML fragments
   */

  this.cleanLoadHTML = function (html, node) {
    var fr = Cc[feedunescapeCID].getService(feedunescapeIID)
                                .parseFragment(html, null, false, null, node);
    node.appendChild(fr);
  };


  /*
   * i18n / l10n
   */

  /* General localization function
   * 'type' can either be any of the L10N_* constants
   */
  this.gettext = function (text, args, type) {
    var strKey = text.replace(' ', '_', "g").toLowerCase();

    // First try getting the current locale's translation
    try {
      var bundle = this.$("euskalbar-leuskal");

      if (type == L10N_FORMATTED) {
        return bundle.getFormattedString(strKey, args);
      } else {
        return bundle.getString(strKey);
      }
    } catch (e) {
      console.log("Failed to get translation for key: " + strKey);
    }

    // If it fails, fall back to en-US
    try {
      var bundle = this.getDefaultStrBundle();

      if (type == L10N_FORMATTED) {
        return bundle.formatStringFromName(strKey, args, args.length);
      } else {
        return bundle.GetStringFromName(strKey);
      }
    } catch (e) {
      console.log("Failed to get translation for key: " + strKey);
    }

    // As a last resource, we use the given text after the last dot
    var index = text.lastIndexOf(".");
    if (index > 0 && text.charAt(index - 1) != "\\") {
      text = text.substr(index + 1);
    }

    text = text.replace("_", " ", "g");

    return text;
  };

  /* Basic localization function */
  this._ = function (text) {
    return this.gettext(text, null, L10N_NORMAL);
  };

  /* Localization function with support for formatted strings.
   * Arguments are passed as an array of possible values.
   */
  this._f = function (text, args) {
    return this.gettext(text, args, L10N_FORMATTED);
  };

  this.defaultStrBundle = null;

  this.getDefaultStrBundle = function () {
    if (!this.defaultStringBundle) {
      var bundleURL = "chrome://euskalbar/locale/euskalbar.properties";
      var fileURI = this.FileIO.getLocalOrSystemPath(bundleURL);

      var parts = fileURI.split("/");
      parts[parts.length - 2] = "en-US";
      this.defaultStrBundle = Services.strings.createBundle(parts.join("/"));
    }

    return this.defaultStrBundle;
  };

  /* Returns the language part of a given locale code */
  this.langCode = function (code) {
    var sepIndex = code.indexOf('-');

    if (sepIndex != -1) {
      return code.slice(0, sepIndex);
    }

    return code;
  };


  /*
   * File IO operations
   */

  this.FileIO = {

      getLocalSystemURI: function (url) {
        try {
          var uri = Services.io.newURI(url, null, null);

          if (uri.schemeIs("resource")) {
            var ph = Services.io.getProtocolHandler("resource").QueryInterface(resphIID);
            var abspath = ph.getSubstitution(uri.host);
            uri = Services.io.newURI(uri.path.substr(1), null, abspath);
          }

          if (uri.schemeIs("chrome")) {
            var chromeRegistry = Cc[chromeregCID].getService(chromeregIID);
            uri = chromeRegistry.convertChromeURL(uri);
          }

          return uri;
        } catch(exc) {
        }
      },

      /* Gets path starting from a URL */
      getLocalOrSystemPath: function (url, allowDirectories) {
        var uri = this.getLocalSystemURI(url);

        if (uri instanceof Ci.nsIFileURL) {
          var file = uri.file;
          if (allowDirectories) {
            return file && file.path;
          } else {
            return file && !file.isDirectory() && file.path;
          }
        }
      },

    };

}).apply(euskalbarLib);
