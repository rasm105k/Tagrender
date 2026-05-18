import unittest
from unittest.mock import Mock

import getdata


class GraphQlClientTests(unittest.TestCase):
    def test_client_posts_query_with_api_key(self):
        session = Mock()
        response = Mock()
        response.status_code = 200
        response.json.return_value = {"data": {"ok": True}}
        response.raise_for_status = Mock()
        session.post.return_value = response

        client = getdata.GraphQlClient("https://example.test/graphql", "secret", session=session)
        result = client.execute("query Test { ok }", {"first": 3})

        self.assertEqual(result, {"ok": True})
        session.post.assert_called_once()
        _, kwargs = session.post.call_args
        self.assertEqual(kwargs["params"], {"apiKey": "secret"})
        self.assertEqual(kwargs["json"]["variables"], {"first": 3})

    def test_client_raises_on_graphql_errors(self):
        session = Mock()
        response = Mock()
        response.status_code = 200
        response.json.return_value = {"errors": [{"message": "Nope"}]}
        response.raise_for_status = Mock()
        session.post.return_value = response

        client = getdata.GraphQlClient("https://example.test/graphql", "secret", session=session)

        with self.assertRaisesRegex(getdata.GraphQlError, "Nope"):
            client.execute("query Test { ok }")


class AddressMappingTests(unittest.TestCase):
    def test_hent_parcelhuse_maps_dar_husnummer_to_lon_lat(self):
        client = Mock()
        client.execute.side_effect = [
            {
                "DAR_Husnummer": {
                    "nodes": [
                        {
                            "id_lokalId": "hus-1",
                            "adgangsadressebetegnelse": "Testvej 1, 1000 København K",
                            "adgangspunkt": "punkt-1",
                        }
                    ]
                }
            },
            {
                "BBR_Bygning": {
                    "nodes": [
                        {
                            "husnummer": "hus-1",
                            "byg021BygningensAnvendelse": 120,
                            "byg041BebyggetAreal": 140,
                        }
                    ]
                }
            },
            {
                "DAR_Adressepunkt": {
                    "nodes": [
                        {
                            "id_lokalId": "punkt-1",
                            "position": {"wkt": "POINT (724196.49 6175760.18)"},
                        }
                    ]
                }
            },
        ]

        addresses = getdata.hent_parcelhuse(1, client=client)

        self.assertEqual(len(addresses), 1)
        self.assertEqual(addresses[0]["id"], "hus-1")
        self.assertEqual(addresses[0]["adresse"], "Testvej 1, 1000 København K")
        self.assertAlmostEqual(addresses[0]["lng"], 12.57, places=1)
        self.assertAlmostEqual(addresses[0]["lat"], 55.68, places=1)

    def test_hent_parcelhuse_filters_out_apartments_and_empty_lots(self):
        client = Mock()
        client.execute.side_effect = [
            {
                "DAR_Husnummer": {
                    "nodes": [
                        {
                            "id_lokalId": "parcelhus",
                            "adgangsadressebetegnelse": "Husvej 1, 1000 København K",
                            "adgangspunkt": "punkt-1",
                        },
                        {
                            "id_lokalId": "lejlighed",
                            "adgangsadressebetegnelse": "Lejlighedsvej 2, 1000 København K",
                            "adgangspunkt": "punkt-2",
                        },
                        {
                            "id_lokalId": "tom-grund",
                            "adgangsadressebetegnelse": "Grundvej 3, 1000 København K",
                            "adgangspunkt": "punkt-3",
                        },
                    ]
                }
            },
            {
                "BBR_Bygning": {
                    "nodes": [
                        {
                            "husnummer": "parcelhus",
                            "byg021BygningensAnvendelse": 120,
                            "byg041BebyggetAreal": 125,
                        },
                        {
                            "husnummer": "lejlighed",
                            "byg021BygningensAnvendelse": 140,
                            "byg041BebyggetAreal": 900,
                        },
                    ]
                }
            },
            {
                "DAR_Adressepunkt": {
                    "nodes": [
                        {
                            "id_lokalId": "punkt-1",
                            "position": {"wkt": "POINT (724196.49 6175760.18)"},
                        }
                    ]
                }
            },
        ]

        addresses = getdata.hent_parcelhuse(3, client=client)

        self.assertEqual([address["id"] for address in addresses], ["parcelhus"])


if __name__ == "__main__":
    unittest.main()
