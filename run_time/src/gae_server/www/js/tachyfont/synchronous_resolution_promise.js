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

goog.provide('tachyfont.SynchronousResolutionPromise');

goog.scope(function() {
var SynchronousResolutionPromise = tachyfont.SynchronousResolutionPromise;



/**
 * Implements a Class with Promise behavior but with synchronous resolution.
 * Asynchronous resolution (eg, Promise/A+/goog.Promise) is incompatible with
 * IndexedDb transactions:
 *
 * IndexedDb transaction requirement:
 *     IndexedDb (IDB) transactions only remain active as long as each callback
 *     immediately uses the transaction in another IDB request/operation. If at
 *     the end of the callback another operation is not *immediately* started
 *     then the transaction is automatically concluded.
 *
 * Asynchronous resolution:
 *     In asynchronous resolution the resolve call is done in a way that allows
 *     other queued promises to potentially run before the resolve is called.
 *     It is as if the resolve is done in a setTimeout. If no other promises are
 *     queued then the resolve may run immediately. But if other promises are
 *     queued then the resolve may not run immediately.
 *
 * Asynchronous resolution is incompatible with IndexedDb transactions because
 * with asynchronous resolution the callback code can immediately start another
 * operation but it may not actually be called immediately. Thus the transaction
 * may be closed before the next operation begins. A closed transaction will
 * cause the next operation to fail.
 *
 * WARNING: Asynchronous resolution is used because it limits the call stack
 * depth. Synchronous resolution does not limit the call stack depth so care
 * must be taken to avoid exceeding maximum call stack depth.
 *
 * @param {!tachyfont.typedef.Resolver} resolver The initialization function
 *     that is invoked immediately with {@code resolve} and {@code reject}
 *     functions as arguments. The Promise is resolved or rejected with the
 *     first argument passed to either function.
 * @constructor @struct @final
 */
tachyfont.SynchronousResolutionPromise = function(resolver) {
  /** @private {SynchronousResolutionPromise.State} */
  this.state_ = SynchronousResolutionPromise.State.PENDING;

  /** @private {*} */
  this.result_;

  /** @private {!Array<!tachyfont.typedef.ThenInfo>} */
  this.deferredThens_ = [];

  try {
    var self = this;
    resolver(
        function(result) {  //
          self.resolve(result);
        },
        function(result) {  //
          self.reject(result);
        });
  } catch (e) {
    this.reject(e);
  }
};


/**
 * Enum for state values.
 * @enum {number}
 */
SynchronousResolutionPromise.State = {
  PENDING: 1,
  RESOLVED: 2,
  REJECTED: 3
};


/**
 * Implements the resolve function.
 * @param {*=} opt_result The resolve value.
 */
tachyfont.SynchronousResolutionPromise.prototype.resolve = function(
    opt_result) {
  if (this.state_ != SynchronousResolutionPromise.State.PENDING) {
    return;
  }

  // Handle getting a Promise as the return value.
  if (opt_result && typeof opt_result.then == 'function') {
    var self = this;
    opt_result.then(
        function(value) {  //
          self.resolve(value);
        },
        function(value) {  //
          self.reject(value);
        });
    return;
  }

  this.result_ = opt_result;
  this.state_ = SynchronousResolutionPromise.State.RESOLVED;

  // Handle attached thens.
  for (var i = 0; i < this.deferredThens_.length; i++) {
    this.runOrDeferTheThen_(this.deferredThens_[i]);
  }
};


/**
 * Implements the reject function.
 * @param {*=} opt_reason The reject value.
 */
tachyfont.SynchronousResolutionPromise.prototype.reject = function(opt_reason) {
  if (this.state_ != SynchronousResolutionPromise.State.PENDING) {
    return;
  }

  // Handle getting a Promise as the return value.
  if (opt_reason && typeof opt_reason.then == 'function') {
    var self = this;
    opt_reason.then(
        function(value) {  //
          self.resolve(value);
        },
        function(value) {  //
          self.reject(value);
        });
    return;
  }

  this.result_ = opt_reason;
  this.state_ = SynchronousResolutionPromise.State.REJECTED;

  // Handle attached thens.
  for (var i = 0; i < this.deferredThens_.length; i++) {
    this.runOrDeferTheThen_(this.deferredThens_[i]);
  }
};


/**
 * Runs or defers the attached thens.
 * @param {!tachyfont.typedef.ThenInfo} thenInfo The info used by an 'attached'
 *     'then' function.
 * @private
 */
tachyfont.SynchronousResolutionPromise.prototype.runOrDeferTheThen_ = function(
    thenInfo) {
  if (this.state_ == SynchronousResolutionPromise.State.PENDING) {
    // Save the then until this resolves or rejects.
    this.deferredThens_.push(thenInfo);
    return;
  }

  // Pass the this Promise's status to the attached then.
  if (this.state_ == SynchronousResolutionPromise.State.RESOLVED) {
    if (thenInfo.thenResolve) {
      var result = thenInfo.thenResolve(this.result_);
      // Calling then creates a Promise. If the then resolve code didn't resolve
      // do it now. If the then did resolve/reject then calling resolve now is
      // harmless because calling resolve a second time has no effect.
      thenInfo.resolve(result);
    } else {
      // Handle an empty then.
      thenInfo.resolve(this.result_);
    }
  } else {
    if (thenInfo.thenReject) {
      var result = thenInfo.thenReject(this.result_);
      // See the comment above in the "if (thenInfo.thenResolve)" clause.
      thenInfo.resolve(result);
    } else {
      // Handle an empty reject.
      thenInfo.reject(this.result_);
    }
  }
};


/**
 * Implements the "then" function.
 * @param {?tachyfont.typedef.ThenResolve=} opt_thenResolve The resolve code.
 * @param {?tachyfont.typedef.ThenReject=} opt_thenReject The reject code.
 * @return {!SynchronousResolutionPromise}
 */
tachyfont.SynchronousResolutionPromise.prototype.then = function(
    opt_thenResolve, opt_thenReject) {
  var self = this;
  /**
   * Explicitly create the resolve function so the parameter can be correctly
   * defined to make the Closure compilier happy.
   * @param {?tachyfont.typedef.Resolve=} resolve The resolve code.
   * @param {?tachyfont.typedef.Reject=} reject The reject code.
   * @return {(*|undefined)}
   */
  var resolver = function(resolve, reject) {
    self.runOrDeferTheThen_({
      thenResolve: opt_thenResolve,
      thenReject: opt_thenReject,
      resolve: resolve,
      reject: reject
    });
  };
  return new tachyfont.SynchronousResolutionPromise(resolver);
};


/**
 * Implements the "thenCatch" function.
 * @param {?tachyfont.typedef.ThenReject} opt_thenReject The reject code.
 * @return {!SynchronousResolutionPromise}
 */
tachyfont.SynchronousResolutionPromise.prototype.thenCatch = function(
    opt_thenReject) {
  return this.then(null, opt_thenReject);
};


/**
 * Returns a resolved Promise.
 * @param {*=} value The resolve value;
 * @return {!SynchronousResolutionPromise}
 */
tachyfont.SynchronousResolutionPromise.resolve = function(value) {
  return new tachyfont.SynchronousResolutionPromise(function(resolve) {
    resolve(value);
  });
};


/**
 * Returns a rejected Promise.
 * @param {*=} value The reject value;
 * @return {!SynchronousResolutionPromise}
 */
tachyfont.SynchronousResolutionPromise.reject = function(value) {
  return new tachyfont.SynchronousResolutionPromise(function(resolve, reject) {
    reject(value);
  });
};

});  // goog.scope