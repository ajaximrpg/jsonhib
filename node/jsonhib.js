/* vim: set expandtab tabstop=3 shiftwidth=3 softtabstop=3: */

/**
* Reads, inserts, deletes, updates and moves rows in MySQL database using the
* JSON (JavaScript Object Notation) format.
*
* LICENSE:
* Copyright (c) 2013, Daniel Howard
* All rights reserved.
* 
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
* 
* 1. Redistributions of source code must retain the above copyright notice,
* this list of conditions and the following disclaimer.
* 
* 2. Redistributions in binary form must reproduce the above copyright notice,
* this list of conditions and the following disclaimer in the documentation
* and/or other materials provided with the distribution.
* 
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
* AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
* IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
* ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
* LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
* CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
* SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
* INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
* CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
* ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
* POSSIBILITY OF SUCH DAMAGE.
*
* @author Daniel Howard <jsonhib@svexpertise.com>
* @copyright 2013 Daniel Howard
* @license http://opensource.org/licenses/BSD-2-Clause
*/

/**
 * Use a database for JSON.
 *
 * @version 0.0.9
 * @author Daniel Howard
 */

   /**
    * Use a database for JSON.
    *
    * Configurations are arrays with keys like "sort_column",
    * "json_column", and "link_identifier" keys.
    *
    * @param config A configuration.
    *
    * @author Daniel Howard
    */
   function jsonhib(config) {
      config = config || {};
      this.config = config;
      this.cache = {};
   }

   /**
    * Get JSON table rows from the database.  The callback function
    * is passed a JSON string of an array of columns and data.
    *
    * If there is no sort column, the rows are in arbitrary
    * order.
    *
    * @param {string} table A database table.
    * @param {string} clause A WHERE clause.
    * @param {function} func A callback function with one argument.
    *
    * @author Daniel Howard
    */
   jsonhib.prototype.readRows = function(table, clause, func) {
      var that = this;
      var config = this.config;

      // cache the table description
      this.readDesc(table, function() {
         var desc = that.cache[table]['desc_a'];
         var sort_field = isset(that.cache[table]['sort_column'])? that.cache[table]['sort_column']: '';
         var json_field = isset(that.cache[table]['json_column'])? that.cache[table]['json_column']: '';
         var sort_clause = (sort_field != '')? 'ORDER BY `'+sort_field+'` ASC': '';

         // read the table
         var q = 'SELECT * FROM `'+table+'` '+clause+' '+sort_clause+';';
         that.mysql_query(q, function(e, rows, f) {
            var objs = [];
            for (var r=0; r < rows.length; ++r) {
               var row = rows[r];
               var obj = {};
               // add the SQL data first
               for (var key in row) {
                  var value = row[key];
                  if (key == 'class') {
                     key = 'clazz';
                  }
                  if (key == json_field) {
                     // add non-SQL JSON data later
                  } else if (key == config['sort_column']) {
                     // sort column isn't user data
                  } else if (value === null) {
                     obj[key] = null;
                  } else if (is_numeric(value) && (strval(intval(value)) == value) && is_bool(desc[key])) {
                     obj[key] = (intval(value) === 1);
                  } else if (is_numeric(value) && (strval(intval(value)) == value) && is_int(desc[key])) {
                     obj[key] = intval(value);
                  } else if (is_numeric(value) && is_float(desc[key])) {
                     obj[key] = floatval(value);
                  } else {
                     var val = ''; try { val = JSON.parse(value); } catch (e) { }
                     obj[key] = is_array(val)? val: value;
                  }
               }
               // add non-SQL JSON data
               if (json_field != '') {
                  var json = JSON.parse(row[json_field]);
                  for (var key in json) {
                     var value = json[key];
                     obj[key] = value;
                  }
               }
               objs.push(obj);
            }
            func(JSON.stringify(objs));
         });
      });
   };

   /**
    * Get a JSON table description from the database.  The callback function
    * is passed a JSON string of columns and default values.
    *
    * It does not return "sort" and "json" columns, if any.
    *
    * @param {string} table A database table.
    * @param {function} func A callback function with one argument.
    *
    * @author Daniel Howard
    */
   jsonhib.prototype.readDesc = function(table, func) {
      var that = this;
      var config = this.config;

      var desc = {};
      if (isset(this.cache[table]) && isset(this.cache[table]['desc'])) {
         desc = this.cache[table]['desc'];
         func(desc);
      } else {
         // read the table description
         var sort_column = '';
         var json_column = '';
         var q = 'DESCRIBE `'+table+'`;';
         this.mysql_query(q, function(e, rows, f) {
            for (var r=0; r < rows.length; ++r) {
               var rowdesc = rows[r];
               field = rowdesc['Field'];
               if (field === config['sort_column']) {
                  sort_column = field;
               } else if (field === config['json_column']) {
                  json_column = field;
               } else if (strpos(rowdesc['Type'], 'tinyint(1)') !== false) {
                  desc[field] = false;
               } else if (strpos(rowdesc['Type'], 'int') !== false) {
                  desc[field] = 0;
               } else if (strpos(rowdesc['Type'], 'float') !== false) {
                  desc[field] = floatval(0);
               } else if (strpos(rowdesc['Type'], 'double') !== false) {
                  desc[field] = floatval(0);
               } else {
                  desc[field] = '';
               }
            }
            // cache the description
            if (!isset(that.cache[table])) {
               that.cache[table] = {};
            }
            that.cache[table]['desc_a'] = desc;
            desc = JSON.stringify(desc);
            that.cache[table]['desc'] = desc;
            if (sort_column != '') {
               that.cache[table]['sort_column'] = sort_column;
            }
            if (json_column != '') {
               that.cache[table]['json_column'] = json_column;
            }
            func(desc);
         });
      }
   };

   /**
    * Insert a row of JSON into a database table.
    *
    * If there is no sort column, it inserts the row, anyway.
    *
    * @param {string} table A database table.
    * @param {string} clause A WHERE clause.
    * @param {number} n The place to insert the row before; -1 means the end.
    * @param {mixed} json A JSON string (string) or JSON array (array).
    * @param {function} func A callback function.
    *
    * @author Daniel Howard
    */
   jsonhib.prototype.insertRow = function(table, clause, n, json, func) {
      var that = this;
      var config = this.config;

      if (is_string(json)) {
         json = JSON.parse(json);
      }

      // cache the table description
      this.readDesc(table, function() {
         var desc = that.cache[table]['desc_a'];
         var sort_field = isset(that.cache[table]['sort_column'])? that.cache[table]['sort_column']: '';
         var json_field = isset(that.cache[table]['json_column'])? that.cache[table]['json_column']: '';
         var sort_clause = (sort_field != '')? 'ORDER BY `'+sort_field+'` DESC': '';

         // overwrite default values with user values
         for (var col in desc) {
            var value = desc[col];
            if (array_key_exists(col, json)) {
               compat = false;
               if (gettype(desc[col]) === gettype(json[col])) {
                  compat = true;
               }
               if (is_float(desc[col]) && is_int(json[col])) {
                  compat = true;
               }
               if (is_string(desc[col])) {
                  compat = true;
               }
               if (compat) {
                  desc[col] = json[col];
                  delete json[col];
               }
            }
         }
         // update the positions
         var q = '';
         var qa = [];
         var func2 = function() {
            // put freeform values into 'json' field
            if (json_field != '') {
               desc[json_field] = json;
            }
            // make the fields and VALUES clauses
            var set_clause = '';
            for (var col in desc) {
               var value = desc[col];
               if (set_clause != '') {
                  set_clause += ', ';
               }
               val = is_array(value)? JSON.stringify(value): value;
               val = is_bool(val)? (val? '1': '0'): val;
               val = is_null(val)? 'NULL': '\''+that.mysql_real_escape_string(val)+'\'';
               set_clause += that.mysql_real_escape_string(col)+'='+val;
            }
            q = 'INSERT INTO `'+table+'` SET '+set_clause+';';
            qa.push(q);
            callback_mysql(that.config['link_identifier'], qa, func);
         };
         if (sort_field != '') {
            q = 'SELECT '+sort_field+' FROM `'+table+'` '+clause+' '+sort_clause+';';
            that.mysql_query(q, function(e, rows, f) {
               for (var r=0; r < rows.length; ++r) {
                  var row = rows[r];
                  n = (n == -1)? row[sort_field] + 1: n;
                  if (n > row[sort_field]) {
                     break;
                  }
                  var set_clause = sort_field+'='+(intval(row[sort_field])+1);
                  var n_clause = (clause == '')? 'WHERE ': 'AND ';
                  n_clause += sort_field+'='+(intval(row[sort_field]));
                  q = 'UPDATE `'+table+'` SET '+set_clause+' '+clause+' '+n_clause+';';
                  qa.push(q);
               }
               if (n == -1) {
                  n = 0;
               }
               desc[sort_field] = n;
               func2();
            });
         } else {
            func2();
         }
      });
   };

   /**
    * Delete a row of JSON from a database table.
    *
    * If there is no sort column, it deletes the first row.
    *
    * @param {string} table A database table.
    * @param {string} clause A WHERE clause.
    * @param {mixed} n The row to delete (int) or JSON data to select the row (string).
    * @param {function} func A callback function.
    *
    * @author Daniel Howard
    */
   jsonhib.prototype.deleteRow = function(table, clause, n, func) {
      var that = this;
      var config = this.config;

      // cache the table description
      this.readDesc(table, function() {
         var desc = that.cache[table]['desc_a'];
         var sort_field = isset(that.cache[table]['sort_column'])? that.cache[table]['sort_column']: '';
         var json_field = isset(that.cache[table]['json_column'])? that.cache[table]['json_column']: '';
         var sort_clause = '';
         var q = '';
         
         var func2 = function() {
            q = 'DELETE FROM `'+table+'` '+clause+' '+sort_clause+';';
            var qa = [q];
            var func3 = function() {
               callback_mysql(that.config['link_identifier'], qa, func);
            };
            // update the positions
            if (sort_field != '') {
               q = 'SELECT '+sort_field+' FROM `'+table+'` '+clause+' ORDER BY `'+sort_field+'` ASC;';
               that.mysql_query(q, function(e, rows, f) {
                  for (var r=0; r < rows.length; ++r) {
                     var row = rows[r];
                     if (row[sort_field] <= n) {
                        continue;
                     }
                     var set_clause = sort_field+'='+(intval(row[sort_field])-1);
                     var n_clause = (clause == '')? 'WHERE ': 'AND ';
                     n_clause += sort_field+'='+(intval(row[sort_field]));
                     q = 'UPDATE `'+table+'` SET '+set_clause+' '+clause+' '+n_clause+';';
                     qa.push(q);
                  }
                  func3();
               });
            } else {
               func3();
            }
         };

         // identify the row
         if ((sort_field != '') && (is_int(n))) {
            sort_clause = ((clause == '')? 'WHERE ': 'AND ')+sort_field+'='+n;
            func2();
         } else {
            sort_clause = '';
            if (is_string(n)) {
               var nn = JSON.parse(n);
               for (var col in nn) {
                  var value = nn[col];
                  sort_clause += ((sort_clause == '') && (clause == ''))? 'WHERE ': ' AND ';
                  sort_clause += col+'=\''+value+'\'';
               }
            }
            q = 'SELECT * FROM `'+table+'` '+clause+' '+sort_clause+';';
            that.mysql_query(q, function(e, rows, f) {
               if (rows.length == 1) {
                  if (sort_field != '') {
                     var row = rows[0];
                     n = row[sort_field];
                  }
                  func2();
               } else {
                  func();
               }
            });
         }
      });
   };

   /**
    * Update a row of JSON in a database table.
    *
    * If there is no sort column, it updates the first row.
    *
    * @param {string} table A database table.
    * @param {string} clause A WHERE clause.
    * @param {mixed} n The row to update (int) or JSON data to select the row (string).
    * @param {mixed} json A JSON string (string) or JavaScript object (object).
    * @param {function} func A callback function.
    *
    * @author Daniel Howard
    */
   jsonhib.prototype.updateRow = function(table, clause, n, json, func) {
      var that = this;
      var config = this.config;

      if (is_string(json)) {
         json = JSON.parse(json);
      }

      // cache the table description
      this.readDesc(table, function() {
         var desc = that.cache[table]['desc_a'];
         var sort_field = isset(that.cache[table]['sort_column'])? that.cache[table]['sort_column']: '';
         var json_field = isset(that.cache[table]['json_column'])? that.cache[table]['json_column']: '';
         var sort_clause = '';
         var json_data = {};

         var func2 = function() {
            var func3 = function() {
               // make the SET clause
               var set_clause = '';
               for (var col in json) {
                  var value = json[col];
                  var compat = false;
                  if (array_key_exists(col, desc)) {
                     if (gettype(desc[col]) === gettype(json[col])) {
                        compat = true;
                     }
                     if (is_float(desc[col]) && is_int(json[col])) {
                        compat = true;
                     }
                     if (is_string(desc[col])) {
                        compat = true;
                     }
                  }
                  if (compat) {
                     // update the SQL data
                     if (set_clause != '') {
                        set_clause += ', ';
                     }
                     var val = is_array(value)? JSON.stringify(value): value;
                     val = is_bool(val)? (val? '1': '0'): val;
                     val = is_null(val)? 'NULL': '\''+that.mysql_real_escape_string(val)+'\'';
                     set_clause += that.mysql_real_escape_string(col)+'='+val;
                     // delete it from the freeform JSON data
                     if (array_key_exists(col, json_data)) {
                        delete json_data[col];
                     }
                  } else {
                     // add it to the freeform JSON data
                     json_data[col] = value;
                  }
               }
               // update the freeform JSON data
               if (json_field != '') {
                  if (set_clause != '') {
                     set_clause += ', ';
                  }
                  set_clause += json_field+'=\''+that.mysql_real_escape_string(JSON.stringify(json_data))+'\'';
               }
               var q = 'UPDATE `'+table+'` SET '+set_clause+' '+clause+' '+sort_clause+';';
               that.mysql_query(q, func);
            };
            // get the freeform JSON data
            if (json_field != '') {
               var q = 'SELECT '+json_field+' FROM `'+table+'` '+clause+' '+sort_clause+';';
               that.mysql_query(q, function(e, rows, f) {
                  if (!e && (rows.length > 0)) {
                     var row = rows[0];
                     json_data = JSON.parse(row[json_field]);
                  }
                  func3();
               });
            } else {
               func3();
            }
         };

         // identify the row
         if ((sort_field != '') && (is_int(n))) {
            sort_clause = ((clause == '')? 'WHERE ': 'AND ')+sort_field+'='+n;
            func2();
         } else {
            sort_clause = '';
            if (is_string(n)) {
               var nn = JSON.parse(n);
               for (var col in nn) {
                  var value = nn[col];
                  sort_clause += ((sort_clause == '') && (clause == ''))? 'WHERE ': ' AND ';
                  sort_clause += col+'=\''+value+'\'';
               }
            }
            var q = 'SELECT * FROM `'+table+'` '+clause+' '+sort_clause+';';
            that.mysql_query(q, function(e, rows, f) {
               if (rows.length == 1) {
                  if (sort_field != '') {
                     var row = rows[0];
                     n = row[sort_field];
                  }
                  func2();
               } else {
                  func();
               }
            });
         }
      });
   };

   /**
    * Reorder a row of JSON in a database table.
    *
    * If there is no sort column, it does nothing.
    *
    * @param {string} table A database table.
    * @param {string} clause A WHERE clause.
    * @param {number} m The row to move.
    * @param {number} n The row to move to.
    * @param {function} func A callback function.
    *
    * @author Daniel Howard
    */
   jsonhib.prototype.moveRow = function(table, clause, m, n, func) {
      var that = this;
      var config = this.config;

      if (m == n) {
         func();
      }

      // cache the table description
      this.readDesc(table, function() {
         var desc = that.cache[table]['desc_a'];
         var sort_field = isset(that.cache[table]['sort_column'])? that.cache[table]['sort_column']: '';
         var sort_clause = (sort_field != '')? 'ORDER BY `'+sort_field+'`': '';

         // update the positions
         if (sort_field != '') {
            var q = 'SELECT '+sort_field+' FROM `'+table+'` '+clause+' '+sort_clause+' DESC;';
            that.mysql_query(q, function(e, rows, f) {
               if (rows.length >= 1) {
                  var row = rows[0];
                  // save the row at the end
                  var temp = intval(row[sort_field]) + 1;
                  var where_clause = clause+((clause != '')? ' AND': 'WHERE')+' '+sort_field+'='+m;
                  q = 'UPDATE `'+table+'` SET '+sort_field+'='+temp+' '+where_clause+';';
                  that.mysql_query(q, function(e, rows, f) {
                     // update positions of other rows as needed
                     var qa = [];
                     sort_clause += ' '+((m < n)? 'ASC': 'DESC');
                     q = 'SELECT '+sort_field+' FROM `'+table+'` '+clause+' '+sort_clause+';';
                     that.mysql_query(q, function(e, rows, f) {
                        for (var r=0; r < rows.length; ++r) {
                           row = rows[r];
                           if (m < n) {
                              if ((row[sort_field] < m)) {
                                 continue;
                              } else if (row[sort_field] > n) {
                                 break;
                              }
                           } else {
                              if ((row[sort_field] > m)) {
                                 continue;
                              } else if (row[sort_field] < n) {
                                 break;
                              }
                           }
                           var set_clause = sort_field+'='+(intval(row[sort_field])+((m < n)? -1: 1));
                           var n_clause = ((clause == '')? 'WHERE ': 'AND ')+sort_field+'='+(intval(row[sort_field]));
                           qa.push('UPDATE `'+table+'` SET '+set_clause+' '+clause+' '+n_clause+';');
                        }
                        // move the row to the new position
                        var set_clause = sort_field+'='+n;
                        var n_clause = ((clause == '')? 'WHERE ': 'AND ')+sort_field+'='+temp;
                        qa.push('UPDATE `'+table+'` SET '+set_clause+' '+clause+' '+n_clause+';');
                        callback_mysql(that.config['link_identifier'], qa, func);
                     });
                  });
               } else {
                  func();
               }
            });
         } else {
            func();
         }
      });
   };

   /**
    * Flexible mysql_query() function.
    * 
    * @param {string} query The query to execute.
    * @param {function} func A callback function.
    * @return {string} The mysql_query() return value.
    *
    * @author Daniel Howard
    */
   jsonhib.prototype.mysql_query = function(query, func) {
      return this.config['link_identifier'].query(query, func);
   };

   /**
    * Flexible mysql_real_escape_string() function.
    * 
    * @param {string} unescaped_string String The string.
    * @return {string} The mysql_real_escape_string() return value.
    *
    * @author Daniel Howard
    */
   jsonhib.prototype.mysql_real_escape_string = function(unescaped_string) {
      return mysql_real_escape_string(unescaped_string, this.config['link_identifier']);
   };

// constructor is the module
module.exports = jsonhib;

/**
 * True if the variable is defined.
 * 
 * @param {mixed} v The variable to check.
 * @returns {Boolean} True if not undefined.
 */
function isset(v) {
   return v !== undefined;
}

/**
 * Get the type but uses PHP constants.  Return NULL,
 * boolean, integer, double, string, array, object or
 * unknown type.
 * 
 * @param {mixed} v The variable to check.
 * @returns {String} The type of the variable.
 */
function gettype(v) {
   if (v === null) {
      return 'NULL';
   } else if ((typeof v) == 'boolean') {
      return 'boolean';
   } else if (((typeof v) == 'number') && ((v % 1) === 0)) {
      return 'integer';
   } else if (((typeof v) == 'number') && (Math.round(v) !== v)) {
      return 'double';
   } else if ((typeof v) == 'string') {
      return 'string';
   } else if (v instanceof Array) {
      return 'array'; // indexed array
   } else if (((typeof v) == 'object') && (v.constructor.name === 'Object')) {
      return 'array'; // associative array
   } else if ((typeof v) == 'object') {
      return 'object';
   }
   return 'unknown type';
}

/**
 * Return true if the varible is NULL.
 * 
 * @param {mixed} v The variable to check.
 * @returns {Boolean} True if it is null.
 */
function is_null(v) {
   return gettype(v) == 'NULL';
}

/**
 * Return true if the variable is a string.
 * 
 * @param {mixed} s The variable to check.
 * @returns {Boolean} True if it is a string.
 */
function is_string(s) {
   return gettype(s) === 'string';
}

/**
 * Return true if the variable is a boolean.
 * 
 * @param {mixed} v The variable to check.
 * @returns {Boolean} True if it is a boolean.
 */
function is_bool(v) {
   return gettype(v) == 'boolean';
}

/**
 * Return true if the variable is an integer.
 * 
 * @param {mixed} v The variable to check.
 * @returns {Boolean} True if it is an integer.
 */
function is_int(s) {
   return gettype(s) === 'integer';
}

/**
 * Return true if the variable is a float.
 * 
 * @param {mixed} v The variable to check.
 * @returns {Boolean} True if it is a float.
 */
function is_float(v) {
   return gettype(v) == 'double';
}

/**
 * Return true if the variable is an array.
 * 
 * @param {mixed} v The variable to check.
 * @returns {Boolean} True if it is an array.
 */
function is_array(v) {
   return gettype(v) == 'array';
}

/**
 * Return true if the variable is an integer or a
 * float.
 * 
 * @param {mixed} v The variable to check.
 * @returns {Boolean} True if it is an integer or a float.
 */
function is_numeric(v) {
   var typ = gettype(v);
   return ((typ == 'integer') || (typ == 'double'));
}

/**
 * Get the string representation of this variable.
 * 
 * @param {mixed} n The variable.
 * @returns {String} The string representation.
 */function strval(n) {
   return ''+n;
}

/**
 * Return the variable as an integer.
 * 
 * @param {mixed} n The variable.
 * @returns {number} The integer representation.
 */
function intval(n) {
   var typ = gettype(n);
   if (typ == 'integer') {
      return n;
   } else if (typ == 'string') {
      return parseInt(n);
   }
   return NaN;
}

/**
 * Return the variable as a float.
 * 
 * @param {mixed} n The variable.
 * @returns {number} The float representation.
 */
function floatval(n) {
   var typ = gettype(n);
   if (typ == 'integer') {
      return n;
   } else if (typ == 'double') {
      return n;
   } else if (typ == 'string') {
      return parseFloat(n);
   }
   return NaN;
}

/**
 * Return true if the key (property) exists in a
 * JavaScript object.
 * 
 * @param {string} k The property.
 * @param {Array} a The object.
 * @returns {Boolean} True if it exists.
 */
function array_key_exists(k, a) {
   return (typeof a[k]) != 'undefined';
}

/**
 * Return the position of a substring in a string.
 * 
 * @param {string} s The string to search.
 * @param {string} needle The string to search for.
 * @param {number} offset The index to start from.
 * @returns {mixed} Return the position (int) or, if not found, false (boolean).
 */
function strpos(s, needle, offset) {
   var p = s.indexOf(needle, offset);
   return (p == -1)? false: p;
}

/**
 * Return a string with escape characters added for MySQL queries.
 * 
 * @param {string} s The string.
 * @returns {string} The escaped string.
 */
function mysql_real_escape_string(s) {
   return (s + '')
      .replace(/\0/g, '\\x00')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '\\\'')
      .replace(/"/g, '\\"')
      .replace(/\x1a/g, '\\\x1a');
}

/**
 * Execute an array of functions synchronously and
 * in order.  Each function must take a single
 * callback argument.
 * 
 * This is a simple implementation of JavaScript
 * Promises.
 * 
 * @param a An array of functions.
 * @param func A callback function to call last.
 */
function callback(a, func) {
   func = func || function() {};
   if (a.length > 0) {
      a = a.slice(0);
      var i = a.length-1;
      var f = function(i) {
         return function() {
            a[i](func);
         };
      }(i);
      --i;
      while (i >= 0) {
         f = function(f, i) {
            return function() {
               a[i](f);
            };
         }(f, i);
         --i;
      }
      f();
   } else {
      func();
   }
}

/**
 * Execute an array of MySQL queries synchronously and
 * in order.
 * 
 * @param conn The MySQL connection.
 * @param qa An array of MySQL statements.
 * @param func A callback function.
 */
function callback_mysql(conn, qa, func) {
   func = func || function() {};
   var fa = [];
   for (var q=0; q < qa.length; ++q) {
      fa.push(function(q) {
         return function(f) {
            conn.query(qa[q], f);
         };
      }(q));
   }
   callback(fa, func);
}
