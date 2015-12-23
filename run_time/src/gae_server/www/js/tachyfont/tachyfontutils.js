'use strict';

/**
 * @license
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

goog.provide('tachyfont.utils');


/**
 * Convert a codepoint to a string.
 *
 * This duplicates the String.fromCodePoint function in ES6.
 *
 * Chrome supports this function but the Closure compiler does not recognize
 * this.
 *
 * @param {number} codePoint The codepoint.
 * @return {string}
 */
tachyfont.utils.stringFromCodePoint = function(codePoint) {
  if (codePoint <= 0xFFFF) {
    return String.fromCharCode(codePoint);
  } else {
    codePoint -= 0x10000;
    var highSurrogate = (codePoint >> 10) + 0xD800;
    var lowSurrogate = (codePoint & 0x3FF) + 0xDC00;
    return String.fromCharCode(highSurrogate, lowSurrogate);
  }
};


if (goog.DEBUG) {
  /**
   * Report the list of codepoints.
   *
   * @param {string} title The title of the codepoint list.
   * @param {!Array.<number>} codesIn The array of codepoints.
   */
  tachyfont.utils.reportCodes = function(title, codesIn) {
    if (goog.DEBUG) {
      if (codesIn.constructor != Array) {
        console.log('tachyfont.utils.codesIn: expected Array but got ' +
            codesIn.constructor);
        debugger; // For debugging a utility function.
        return;
      }
      var codes = codesIn.slice();
      codes.sort(function(a, b) { return a - b });

      console.log('----------');
      console.log(title + ':');
      var formattedOutput = '  ';
      var str = '';
      for (var i = 0; i < codes.length; i++) {
        var code = codes[i];
        if (typeof codes[i] != 'number') {
          console.log(title + '[' + i + '] not a number: ' + typeof codes[0]);
          debugger; // For debugging a utility function.
          return;
        }
        formattedOutput +=
            ' 0x' + ('00000' + code.toString(16)).substr(-5) + ',';
        str += tachyfont.utils.stringFromCodePoint(code);
        if (i % 8 == 7) {
          formattedOutput += '   "' + str + '"';
          console.log(formattedOutput);
          formattedOutput = '  ';
          str = '';
        }
      }
      if (i && i % 8 != 0) {
        formattedOutput += '   "' + str + '"';
        console.log(formattedOutput);
      }
      if (codes.length == 0) {
        console.log('  <no codes>');
      }
      console.log('----------');
    }
  };
}

