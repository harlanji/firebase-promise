/**
 * Wraps a given firebaseRef and returns promises when callbacks
 * would normally be taken, and promise-wrapped references where references
 * are usually returned... the rest are just delegated.
 *
 * See push() and transaction() for notes on slight asymmetries.
 */

function FirebaseP (firebaseRef) {
  QueryP.call(this, firebaseRef, this);

  this._firebaseRef = firebaseRef;
}

(function () {
  $.extend(FirebaseP.prototype, QueryP.prototype, {
    auth: delegateFunction('auth'),
    unauth: delegateFunction('unauth'),
    child: refFunction('child'),
    parent: refFunction('parent'),
    root: refFunction('root'),
    name: delegateFunction('name'),
    toString: delegateFunction('toString'),
    set: nullSuccessFunction('set'),
    update: nullSuccessFunction('update'),
    remove: nullSuccessFunction('remove'),
    push: push,
    setWithPriority: nullSuccessFunction('setWithPriority'),
    setPriority: nullSuccessFunction('setPriority'),
    transaction: transaction
  });

  function push (value) {
    var firebaseRef = this._firebaseRef;

    // push is a mismatch because it returns the child right away,
    // but it also has an onComplete callback like nullSuccessFunction.
    // so mimic the behavior and don't return a promise if we are not
    // given a value.

    var childRef = firebaseRef.push();
    var childRefP = new FirebaseP(childRef);

    if (arguments.length == 0) {
      return childRefP;
    }

    // since we already obtained the ID we will update,
    // use our set API to make this code a bit cleaner.
    //
    // we could enhance the API a bit and take priority,
    // and use setWithPriority.

    var setPromise = childRefP.set(value);

    return setPromise;
  }

  // NOTE the localCommit function breaks the promise style...
  //      I could have passed it an event source or something, but
  //      the whole thing is kind of an impedence mismatch.
  //      ideas? hopefully this functionality is used infrequently...
  function transaction (updateFunction, applyLocally, localCommit) {
    var firebaseRef = this._firebaseRef;
    
    return new RSVP.Promise(function (resolve, reject) {
      firebaseRef.transaction(updateFunction, function transactionCallback (err, committed, snapshot) {
        if (err != null) {
          reject(err);
          return;
        }

        if (committed) {
          resolve(snapshot);
        } else {
          // progress / notify?
          // this is possibly an incongruency--transactionCallback will be caled many times,
          // wheras a promise can only resolve once. we could map it as notifying of
          // local commit.
          //notify();
          if (typeof(localCommit) == 'function') { localCommit(snapshot); };
        }
      }, applyLocally);
    });
  }

  function nullSuccessFunction (targetName) {
    var firebaseRef = this._firebaseRef;
    
    return function () {
      var args = Array.prototype.slice.call(arguments, 0);

      var promise = new RSVP.Promise(function firebasePromise (resolve, reject) {
        args.push(function onComplete (err) {
          if (err != null) {
            reject(err);
            return;
          } 
          
          resolve();
        });

        firebaseRef[targetName].apply(firebaseRef, args);
      });

      return promise;
    };
  }

  function delegateFunction (targetName) {
      return function () {
        var firebaseRef = this._firebaseRef;
        return firebaseRef[targetName].apply(firebaseRef, arguments);
      }
  }

  function refFunction (targetName) {
    return function () {
      var firebaseRef = this._firebaseRef;
      var result = firebaseRef[targetName].apply(firebaseRef, arguments);

      return new FirebaseP(result);
    }
  }
})();



function QueryP (query, firebaseP) {
  this._query = query;
  this.ref = function () { return firebaseP; }
}


(function () {
  $.extend(QueryP.prototype, {
    on: delegateFunction('on'),
    off: delegateFunction('off'),
    once: once,
    limit: refFunction('limit'),
    startAt: refFunction('startAt'),
    endAt: refFunction('endAt')
  });

  function once (eventType) {
    var query = this._query;

    return new RSVP.Promise(function (resolve, reject) {
      query.once(eventType, function onceCallback (snapshot) {
        resolve(snapshot);
      }, function () {
        reject();
      });
    });
  }

  function delegateFunction (targetName) {
  return function () {
    var query = this._query;
    return query[targetName].apply(query, arguments);
  }
  }

  function refFunction (targetName) {
    return function () {
      var query = this._query;
      var result = query[targetName].apply(query, arguments);

      return new QueryP(result, this.ref());
    }
  }
})();

